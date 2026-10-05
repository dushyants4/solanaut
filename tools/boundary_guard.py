#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""boundary_guard.py -- turn CLAUDE.md's never-touch list into a permission.

Vendored into Solanaut 2026-09-27 from the Office (office main, last changed in fb6188b),
with the fail-open fix of 2026-09-03 and the seat gate. The logic is unchanged; the policy
(plugins/harness/hooks/boundaries.toml) and the self-test matrix are Solanaut's own.

WAT layer 3. A PreToolUse hook: it reads the tool call on stdin, decides, and
either says nothing (proceed) or emits a deny carrying the reason.

    echo '<hook json>' | uv run --script tools/boundary_guard.py
    uv run --script tools/boundary_guard.py --selftest     # the fault matrix
    uv run --script tools/boundary_guard.py --explain      # what it can/cannot see

WHY THIS EXISTS
    Measured across the 31-repo harvest: 0 of 1,435 agents declare
    disallowedTools, and no hook in the corpus binds a write boundary to
    anything. The nearest equivalent -- protect-mcp, used by wshobson/agents --
    runs with `--fail-on-missing-policy false`, so deleting its policy file
    permits every call, silently. Office's charter names that the worst
    available behaviour for a check whose only product is being believed.

FAIL-CLOSED
    Missing policy, unparseable policy, empty policy, unreadable input, or an
    unexpected input shape -> DENY, with the reason and the fix.

    Fail-closed is only survivable because the guarded surface is NARROW:
    Write, Edit, NotebookEdit, Bash. Read, Grep, Glob and the rest are never
    guarded, so a broken policy still leaves the session able to diagnose and
    repair itself. That is a deliberate trade, not an oversight.

WHAT IT CANNOT SEE
    Bash coverage is heuristic and partial by construction -- see --explain,
    which enumerates the known bypasses instead of implying there are none.
    Write/Edit/NotebookEdit coverage is exact, because the path is structured.

TWO HARNESSES (SOLANAUT, 2026-10-05)
    Claude Code runs it from .claude/settings.json; Codex from .codex/hooks.json,
    with --harness codex. Codex edits files through apply_patch, whose patch text
    names every file it touches on a header line, so that coverage is exact too.
    Codex reads only through the shell, so a shell command that names the
    Gubernaut workspace or another project is refused even when it only reads.
    A rule marked `harness = "codex"` binds Codex alone: the law, its own
    harness and the gates are the human's and Claude's to change, not Codex's.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import sys
import tomllib
from pathlib import Path

OFFICE = Path(__file__).resolve().parent.parent
DEFAULT_POLICY = OFFICE / "plugins" / "harness" / "hooks" / "boundaries.toml"
POLICY = Path(os.environ.get("OFFICE_BOUNDARY_POLICY") or DEFAULT_POLICY)

# Only these are guarded. Everything else proceeds untouched -- see FAIL-CLOSED.
PATH_TOOLS = {"Write": "file_path", "Edit": "file_path",
              "NotebookEdit": "notebook_path"}
BASH_TOOLS = {"Bash"}
# Codex: the patch text arrives in tool_input.command.
PATCH_TOOLS = {"apply_patch"}
GUARDED = set(PATH_TOOLS) | BASH_TOOLS | PATCH_TOOLS
HARNESSES = ("claude", "codex")

# Codex's patch grammar names each file a patch touches on a header line of its own.
PATCH_FILE = re.compile(r"^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+?)\s*$", re.M)


# "a:/x" is absolute on Windows and relative to pathlib on Linux. The guard has
# to agree with itself on both, or its own fault matrix fails in CI for a reason
# that has nothing to do with the boundary being tested.
WIN_DRIVE = re.compile(r"^[A-Za-z]:[/\\]")


def is_absolute(p: str) -> bool:
    return bool(WIN_DRIVE.match(p)) or Path(p).is_absolute()


def norm(p: str) -> str:
    """Case- and separator-insensitive. Windows needs both."""
    return str(p).replace("\\", "/").rstrip("/").lower()


def real(p: str) -> str:
    """norm() plus symlink/`..`/doubled-separator resolution.

    BOUNDARY_GUARD_DEFECT.md SS1: norm() alone treats "~/Work/gubernaut/x" and its
    canonical target as two different strings, so every deny_path was defeated by
    writing the other spelling. Path.resolve() answers "..", a trailing or doubled
    separator, and a symlink in the middle of the path -- and does so without the
    target needing to exist yet, which a Write to a new file requires.
    Falls back to norm() only if resolution itself errors (e.g. a component that
    is not a directory); a resolution failure must never read as a safe path.
    """
    try:
        return norm(str(Path(p).resolve()))
    except OSError:
        return norm(p)


# BOUNDARY_GUARD_DEFECT.md SS2b/SS2c: a bare ">" in [bash].mutating matches the closing
# angle bracket of the mandated commit trailer "<noreply@anthropic.com>" and any other
# ">" that occurs in prose, in a URL, or in a diff -- none of which redirect anything.
# This matches only a ">"/">>" that is plausibly real shell redirection: preceded by
# whitespace/start/an operator (optionally an fd number), followed by a target with no
# intervening whitespace before it ends or hits a quote. A redirect written with no
# surrounding whitespace at all ("cat a>b") evades this, traded deliberately -- every
# existing selftest case and every redirect actually used in this tree carries spacing.
#
# SOLANAUT, 2026-09-27: the target may also START with a quote, as long as the quote opens
# something ("> '/path with spaces/x'"). The Office's pattern refused any quoted target, and
# every path into the Gubernaut workspace contains spaces and so must be quoted: the one
# redirect this policy exists to stop was the one shape it could not see. Shown failing in the
# selftest ("bash redirect into APEX") before this line changed. A ">" that merely precedes a
# closing quote, as in prose ending "... >", still does not count.
#
# SOLANAUT, 2026-10-05: ">&" followed by a digit or "-" duplicates or closes a stream ("2>&1") and
# writes no file. Counted as a write, it refused any command that both named a protected path and
# kept its errors, which agent shells do constantly. ">& file" still counts. Shown failing in the
# selftest ("bash 2>&1 beside a protected path") before this line changed.
REDIRECT = re.compile(r'(?:^|[\s;&|(])\d{0,2}>{1,2}(?!&[\d-])(?=\s*(?:["\'][^\s"\']|[^\s"\']))')


def emit_deny(reason: str) -> int:
    """Deny in both harnesses' terms: the decision as JSON on stdout, the reason on
    stderr, and exit 2, on which Claude Code and Codex each block the call."""
    json.dump({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }}, sys.stdout)
    sys.stdout.write("\n")
    sys.stderr.write(reason + "\n")
    return 2


def load_policy(path: Path) -> tuple[dict | None, str]:
    """Return (policy, error). A policy that cannot be trusted is not a policy."""
    if not path.exists():
        return None, (f"boundary policy not found at {path}. This guard fails "
                      f"closed: with no policy it denies rather than permits. "
                      f"Restore the file, or remove the hook deliberately.")
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        return None, f"boundary policy at {path} is unparseable: {e}"
    rules = data.get("rule") or []
    if not rules:
        return None, (f"boundary policy at {path} declares no rules. An empty "
                      f"policy would permit everything, which is a fail-open in "
                      f"disguise. Declare a rule, or remove the hook.")
    for r in rules:
        if not r.get("deny_paths") and not r.get("deny_globs"):
            return None, (f"rule '{r.get('name', '?')}' declares neither "
                          f"deny_paths nor deny_globs -- it can match nothing, "
                          f"so the policy would report clean while blind.")
        if r.get("harness") not in (None, *HARNESSES):
            return None, (f"rule '{r.get('name', '?')}' is for harness "
                          f"{r.get('harness')!r}, which is not one of {', '.join(HARNESSES)}: "
                          f"it would bind no session, so the policy would report clean while blind.")
    meta = data.get("meta") or {}
    expected_host = meta.get("machine_hostname")
    actual_host = os.uname().nodename
    if not expected_host or expected_host != actual_host:
        return None, (f"boundary policy machine_hostname is {expected_host!r}, "
                      f"but this machine is {actual_host!r}. Refusing a policy "
                      "that was not validated for this host.")
    roots = meta.get("required_roots") or []
    if not roots:
        return None, "boundary policy declares no required_roots"
    missing = [root for root in roots if not Path(root).is_dir()]
    if missing:
        return None, ("protected roots are missing: " + ", ".join(missing) +
                      ". A moved or unmounted boundary is not silently ignored.")
    # Every deny_path must be on disk too, and this is the check the guard was missing.
    # required_roots only proves that SOME named directories survived; it says nothing
    # about the paths the rules actually match on. A policy with valid meta and stale
    # deny_paths parses, loads, reports healthy, and permits every write it exists to
    # refuse -- which is precisely the state this guard was found in after the migration.
    stale = [d for r in rules for d in (r.get("deny_paths") or [])
             if not Path(d).exists()]
    if stale:
        return None, ("these deny_paths do not exist, so the rules naming them can "
                      "match nothing and the policy would permit what it forbids: "
                      + ", ".join(sorted(set(stale))) +
                      ". Repoint them, or delete the rule deliberately.")
    return data, ""


def match_globs(target: str, globs: list[str]) -> str | None:
    base = target.rsplit("/", 1)[-1]
    for g in globs:
        gl = g.lower()
        if gl.startswith("**/"):
            if fnmatch.fnmatch(base, gl[3:]):
                return g
        elif fnmatch.fnmatch(target, gl):
            return g
    return None


def is_home_session(payload: dict) -> bool:
    """Is the session running this call actually THIS department's session?

    BOUNDARY_GUARD_DEFECT.md SS2/SS3e. This hook installs per PLUGIN, so it fires in
    every session that has the plugin enabled, regardless of whose repository that
    session is working in. That is what let Office's `sibling-departments` rule deny
    C.A. Web writing to `site/` -- its own charter boundary -- and deny the Chair a
    Bash call, and it is what SS3e found still happening after the `hooks.json` fix,
    because a plugin's hook REGISTRATION is cached for the life of the Claude Code
    process while this script's policy is re-read on every invocation.

    So the seat gating goes here, where it takes effect immediately: compare the
    session's cwd against this guard's own department root.

    FAILS TOWARD ENFORCEMENT. A missing, unreadable or unresolvable cwd returns True,
    so an input the guard cannot classify gets the full policy rather than the
    reduced one. Never the other way round.
    """
    raw = payload.get("cwd")
    if not raw or not isinstance(raw, str):
        return True
    try:
        return real(raw) == real(str(OFFICE)) or real(raw).startswith(real(str(OFFICE)) + "/")
    except OSError:
        return True


def check_path(target: str, policy: dict, home: bool = True) -> tuple[str, str] | None:
    """Return (rule_name, reason) if denied. Exact -- the path is structured.

    Compares resolved paths (SS1), so a symlink, "..", or a doubled separator
    cannot spell a denied file into an allowed one.

    `home` is is_home_session(). When False, only the UNIVERSAL rules apply --
    those written as deny_globs, which is every `secrets`-shaped rule in all four
    policies and the one rule this file's own comments call "correct on any
    machine". Territorial rules, written as deny_paths, describe what THIS
    department may not touch, and adjudicating them against a session belonging to
    someone else is the SS2 category error: this guard has no standing to tell
    another department where it may write in its own repository. That department's
    own guard does, and does fire, because its cwd IS its home.
    """
    t = real(target)
    for rule in policy["rule"]:
        if home:
            for d in rule.get("deny_paths", []):
                dn = real(d)
                if t == dn or t.startswith(dn + "/"):
                    return rule["name"], rule.get("reason", "")
        if match_globs(t, rule.get("deny_globs", [])):
            return rule["name"], rule.get("reason", "")
    return None


def spellings(d: str, policy: dict, by_name: bool = False) -> set[str]:
    """The ways a shell command may spell protected path `d`, normalised: as written; resolved;
    from the policy's home as ~, $HOME and ${HOME}; and relative to this repository. With
    `by_name`, for the never-read rules, also its last component alone when that is distinctive
    (12 characters or more), which a relative climb such as ../<name> leaves in the command."""
    out = {norm(d)}
    try:
        out.add(norm(str(Path(d).resolve())))
    except OSError:
        pass
    home = norm((policy.get("meta") or {}).get("home") or str(Path.home()))
    repo = real(str(OFFICE))
    for s in list(out):
        if s.startswith(home + "/"):
            rest = s[len(home):]
            out |= {"~" + rest, "$home" + rest, "${home}" + rest}
        if s.startswith(repo + "/"):
            out.add(s[len(repo) + 1:])
        name = s.rsplit("/", 1)[-1]
        if by_name and len(name) >= 12:
            out.add(name)
    return out


def mentions(command: str, spelling: str) -> bool:
    """`spelling` occurs in `command` as a whole path, not as the start of a longer name:
    /home/dashy/work matches /home/dashy/work/x, never /home/dashy/workspace."""
    return re.search(re.escape(spelling) + r"(?![a-z0-9_.-])", command) is not None


def check_bash(command: str, policy: dict, home: bool = True) -> tuple[str, str, str] | None:
    """HEURISTIC. Returns (rule_name, reason, "read" or "write") if denied.

    Writes: denied when a protected path AND a mutating verb co-occur. Reads: denied when
    the command names a path whose rule says `deny_reads = true`, whatever the verb.

    The Office allowed every read, so that it could read its reference corpus and sibling
    departments. Solanaut may not read the Gubernaut workspace at all, and Codex reads only
    through the shell, where no harness setting denies it, so those rules refuse a mention.
    Matching stays partial, and the limit is stated in --explain rather than hidden.

    ">"/">>" are matched by REDIRECT, not by substring, so a ">" inside prose,
    a URL, or the mandated commit trailer does not count as mutating (SS2b/2c).
    Deny_paths are matched in every spelling `spellings()` gives, so a command built from
    the ~/Work symlink, the canonical path, a tilde or a repo-relative path is checked the
    same way (SS1, best-effort: Bash coverage stays heuristic, see --explain).
    """
    c = norm(command)
    if home:
        for rule in policy["rule"]:
            if rule.get("deny_reads"):
                for d in rule.get("deny_paths", []):
                    if any(mentions(c, s) for s in spellings(d, policy, by_name=True)):
                        return rule["name"], rule.get("reason", ""), "read"
    verbs = [v.lower() for v in policy.get("bash", {}).get("mutating", []) if v not in (">", ">>")]
    mutating = any(v in c for v in verbs) or REDIRECT.search(c) is not None
    if not mutating:
        return None
    for rule in policy["rule"]:
        if home:
            for d in rule.get("deny_paths", []):
                if any(mentions(c, s) for s in spellings(d, policy)):
                    return rule["name"], rule.get("reason", ""), "write"
        for g in rule.get("deny_globs", []):
            frag = g.lower().replace("**/", "").replace("*", "")
            if len(frag) > 3 and frag in c:
                return rule["name"], rule.get("reason", ""), "write"
    return None


def decide(payload: dict, policy_path: Path | None = None, harness: str = "claude") -> tuple[bool, str]:
    """Return (denied, reason). `harness` selects the rules marked for one harness."""
    tool = payload.get("tool_name")
    if tool not in GUARDED:
        return False, ""

    policy, err = load_policy(policy_path or POLICY)
    if policy is None:
        return True, f"BOUNDARY GUARD (fail-closed): {err}"
    policy = {**policy, "rule": [r for r in policy["rule"] if r.get("harness") in (None, harness)]}

    ti = payload.get("tool_input")
    if not isinstance(ti, dict):
        return True, ("BOUNDARY GUARD (fail-closed): tool_input was "
                      f"{type(ti).__name__}, not an object. The guard cannot see "
                      "what this call touches, so it refuses.")

    if tool in PATH_TOOLS:
        raw = ti.get(PATH_TOOLS[tool])
        if not raw or not isinstance(raw, str):
            return True, (f"BOUNDARY GUARD (fail-closed): {tool} carried no "
                          f"readable {PATH_TOOLS[tool]}, so the target is "
                          f"unknown. Unknown is denied, never assumed safe.")
        cwd = payload.get("cwd") or os.getcwd()
        target = raw if is_absolute(raw) else str(Path(cwd) / raw)
        hit = check_path(target, policy, is_home_session(payload))
        if hit:
            return True, (f"BOUNDARY GUARD: {tool} to {raw} is denied by rule "
                          f"'{hit[0]}'.\n\n{hit[1]}\n\n"
                          f"This is a write boundary, not a warning. If the edit "
                          f"is genuinely needed, state the exact edit and let its "
                          f"owner make it -- CLAUDE.md, the seven seats.")
        return False, ""

    if tool in PATCH_TOOLS:
        text = ti.get("command")
        if not isinstance(text, str):
            return True, ("BOUNDARY GUARD (fail-closed): apply_patch carried no readable "
                          "patch text, so its targets are unknown. Unknown is denied.")
        targets = PATCH_FILE.findall(text)
        if not targets:
            return True, ("BOUNDARY GUARD (fail-closed): this patch names no file on an "
                          "'*** Add File:', '*** Update File:', '*** Delete File:' or "
                          "'*** Move to:' line, so its targets are unknown. Unknown is denied.")
        cwd = payload.get("cwd") or os.getcwd()
        home = is_home_session(payload)
        for raw in targets:
            target = raw if is_absolute(raw) else str(Path(cwd) / raw)
            hit = check_path(target, policy, home)
            if hit:
                return True, (f"BOUNDARY GUARD: apply_patch to {raw} is denied by rule "
                              f"'{hit[0]}'.\n\n{hit[1]}\n\n"
                              f"This is a write boundary, not a warning. Do not work round it. "
                              f"If the edit is genuinely needed, write the exact edit in the run "
                              f"record for its owner (AGENTS.md).")
        return False, ""

    cmd = ti.get("command")
    if isinstance(cmd, list) and all(isinstance(x, str) for x in cmd):
        cmd = " ".join(cmd)  # an argument list is inspected as the command it spells
    if not isinstance(cmd, str):
        return True, ("BOUNDARY GUARD (fail-closed): Bash carried no readable "
                      "command string.")
    hit = check_bash(cmd, policy, is_home_session(payload))
    if hit and hit[2] == "read":
        return True, (f"BOUNDARY GUARD: this command names a path Solanaut never reads "
                      f"or writes. Denied by rule '{hit[0]}'.\n\n{hit[1]}\n\n"
                      f"If something there is needed, ask the human; do not reach it by "
                      f"another spelling.")
    if hit:
        return True, (f"BOUNDARY GUARD: this Bash command names a protected path "
                      f"AND contains a mutating verb. Denied by rule "
                      f"'{hit[0]}'.\n\n{hit[1]}\n\n"
                      f"Bash matching is heuristic. If this is a false positive, make the "
                      f"edit with the file tool the guard checks exactly (Write or Edit in "
                      f"Claude Code, apply_patch in Codex), not a shell mutation.")
    return False, ""


EXPLAIN = """\
boundary_guard.py -- what it can and cannot see

CAN SEE (exact)
  Write, Edit, NotebookEdit. The path arrives structured, is resolved against
  cwd, then Path.resolve()d before comparison to deny_paths prefixes and
  deny_globs basenames -- so a symlink, "..", or a doubled separator cannot
  spell a denied file into an allowed one. No input shape hides the target: a
  missing or non-string path is itself a denial.

  Codex's apply_patch. Every file the patch adds, updates, deletes or moves to
  is named on a header line; each is checked as above. A patch that names no
  file, or carries no readable text, is a denial.

CANNOT SEE (partial, by construction)
  Bash. The guard denies a write only when a protected path AND a mutating verb
  appear in the same command string, and a read when the command names a path
  whose rule says deny_reads. deny_paths are checked as written, resolved, from
  the home as ~, $HOME or ${HOME}, and relative to this repository; a never-read
  path also by its last component when that is distinctive. ">"/">>" are
  matched only when they look like real redirection (REDIRECT), not as a bare
  substring, so the mandated commit trailer's "<noreply@anthropic.com>" does not
  read as a write, and neither does "2>&1". Known bypasses, stated rather than
  implied:
    1. cd into a protected directory first, then write with a relative path.
    2. Build the path from a variable or command substitution.
    3. Write through an interpreter -- python -c, node -e -- whose argument
       the guard does not parse.
    4. Use a mutating verb absent from the [bash] mutating list.
    5. Quote or encode the path so it does not match literally.
    6. A redirect written with no surrounding whitespace ("cat a>b") evades
       REDIRECT -- traded deliberately so a ">" in prose or a URL does not.
    7. Reach a never-read path through a symlink or an alias the policy does
       not name, or a relative climb whose last component is short (../Work).

  A full shell parser is not attempted. The threat model is my own mistake,
  not an adversary, and a checker that pretends to cover a surface it cannot
  is the exact defect this office exists to avoid. So the limit is written
  down: here, in boundaries.toml, and in evals/harness/boundary_guard.md.

NOT GUARDED AT ALL (deliberate)
  Read, Grep, Glob, WebFetch, everything else. The guard is about writes, and
  about shell reads of the paths that are never read. Claude Code's Read tool
  is kept out of them by .claude/settings.json. Keeping the surface narrow is
  what makes fail-closed survivable: when the policy breaks, a Claude session
  can still read, diagnose and repair itself. A Codex session cannot, since its
  reads are shell commands: the human, or Claude, repairs the policy.

HARNESS RULES
  A rule marked harness = "codex" binds only a guard run with --harness codex
  (.codex/hooks.json): Codex may not change the law, its harness or the gates.
"""


def patch(cwd: str, body: str) -> dict:
    """A Codex apply_patch call, as its PreToolUse hook receives it."""
    return {"tool_name": "apply_patch", "cwd": cwd,
            "tool_input": {"command": "*** Begin Patch\n" + body + "\n*** End Patch\n"}}


def selftest() -> int:
    """The T3 gate: a gate never demonstrated failing is not a gate."""
    here = str(OFFICE).replace("\\", "/")
    APEX = "/home/dashy/Projects/A - Gubernaut Project - APEX"
    cases = [
        # --- Solanaut's territorial rules: nothing outside this folder that belongs to
        # --- another project, and least of all the Gubernaut tree it was split from.
        ("write into the APEX tree", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": APEX + "/DASHY.md"}}, True),
        ("write through the ~/Work symlink into APEX", {
            "tool_name": "Edit", "cwd": here,
            "tool_input": {"file_path": "/home/dashy/Work/gubernaut/site/STATUS.md"}}, True),
        ("..-traversal from Solanaut into APEX", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": here + "/../A - Gubernaut Project - APEX/CLAUDE.md"}}, True),
        ("write the APEX VS Code workspace file", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": APEX + ".code-workspace"}}, True),
        ("write into another project (Dashy Personal)", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": "/home/dashy/Projects/Dashy Personal/notes.md"}}, True),
        ("write APEX's Claude memory", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": "/home/dashy/.claude/projects/"
                           "-home-dashy-Projects-A---Gubernaut-Project---APEX/memory/x.md"}}, True),
        ("write the user-level Claude settings", {
            "tool_name": "Edit", "cwd": here,
            "tool_input": {"file_path": "/home/dashy/.claude/settings.json"}}, True),
        ("write into the shared plans folder", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": "/home/dashy/.claude/plans/some-plan.md"}}, True),
        ("write the Codex config", {
            "tool_name": "Edit", "cwd": here,
            "tool_input": {"file_path": "/home/dashy/.codex/config.toml"}}, True),
        ("write into the intake drop (read-only, byte for byte)", {
            "tool_name": "Edit", "cwd": here,
            "tool_input": {"file_path": here + "/Docs-Dashy-Drop/Gubernaut Solana Colosseum Research Plan.md"}}, True),
        # --- What Solanaut must still be able to do.
        ("write Solanaut's OWN Claude memory (must be ALLOWED)", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": "/home/dashy/.claude/projects/"
                           "-home-dashy-Projects-Solanaut/memory/MEMORY.md"}}, False),
        ("ordinary Solanaut write", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": here + "/packages/sdk/src/guard.ts"}}, False),
        ("relative Solanaut write", {
            "tool_name": "Edit", "cwd": here,
            "tool_input": {"file_path": "README.md"}}, False),
        # --- Secrets, everywhere. A Solana keypair is a JSON file, so it gets its own shapes.
        ("write a .env", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": here + "/.env"}}, True),
        ("write a Solana keypair by name", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": here + "/agent-keypair.json"}}, True),
        ("write into keys/", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": here + "/keys/sandbox-agent.json"}}, True),
        ("write the default CLI wallet shape (id.json)", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": here + "/id.json"}}, True),
        ("write a private key", {
            "tool_name": "Write", "cwd": here,
            "tool_input": {"file_path": here + "/certs/server.pem"}}, True),
        # --- Bash, heuristic by construction (see --explain).
        ("bash rm inside APEX", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "rm -rf '" + APEX + "/DASHY.md'"}}, True),
        ("bash cp into ~/Work", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "cp notes.md /home/dashy/Work/gubernaut/office/notes.md"}}, True),
        ("bash redirect into APEX", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "echo x > '" + APEX + "/x.md'"}}, True),
        ("prose ending in '>' before a closing quote, naming a protected path (must be ALLOWED)", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": 'git commit -m "docs: nothing is written under /home/dashy/.codex >"'}}, False),
        ("bash read of a folder no rule protects (must be ALLOWED)", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "ls /home/dashy/Projects"}}, False),
        # --- Reads, 2026-10-05. Codex reads only through the shell, and no harness setting
        # --- denies it the Gubernaut workspace, so a command that names it is refused here.
        ("bash read of the APEX tree", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "cat '" + APEX + "/CLAUDE.md'"}}, True),
        ("bash read of ~/Work, spelt with a tilde", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "ls ~/Work/gubernaut"}}, True),
        ("bash read by relative traversal into APEX", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": 'ls "../A - Gubernaut Project - APEX"'}}, True),
        ("bash search of another project (Dashy Personal)", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": 'grep -rn solana "/home/dashy/Projects/Dashy Personal"'}}, True),
        ("bash read of the Codex config, protected from writes only (must be ALLOWED)", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "cat ~/.codex/config.toml"}}, False),
        ("bash 2>&1 beside a protected path duplicates a stream, writes nothing (must be ALLOWED)", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "test -w $HOME/.codex 2>&1 | head -3"}}, False),
        ("bash >& into a protected file still writes it", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "echo x >& $HOME/.codex/config.toml"}}, True),
        ("bash rm in the intake drop, by its path relative to the repo", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "rm Docs-Dashy-Drop/notes.md"}}, True),
        ("bash write of a git hook", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "echo 'exit 0' > .git/hooks/pre-commit"}}, True),
        ("bash write inside Solanaut", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "mkdir -p .sandbox && echo hi > .sandbox/scratch.txt"}}, False),
        ("bash commit message, mandated trailer, mentions .env in prose (must be ALLOWED)", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": 'git commit -m "sdk: read the RPC url from .env.example\n\n'
                           'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'}}, False),
        # --- Fail-closed shapes.
        ("unguarded tool passes through", {
            "tool_name": "Read", "cwd": here,
            "tool_input": {"file_path": APEX + "/CLAUDE.md"}}, False),
        ("malformed tool_input denies", {
            "tool_name": "Write", "cwd": here, "tool_input": "not-an-object"}, True),
        ("missing file_path denies", {
            "tool_name": "Write", "cwd": here, "tool_input": {}}, True),
        ("missing cwd falls back to full enforcement (must DENY)", {
            "tool_name": "Write",
            "tool_input": {"file_path": APEX + "/DASHY.md"}}, True),
        # --- The seat gate, kept from the Office: a session rooted elsewhere is not this
        # --- guard's to police, except for the universal secrets rule.
        ("a foreign session writing its own repo (must be ALLOWED, not Solanaut's call)", {
            "tool_name": "Write", "cwd": APEX,
            "tool_input": {"file_path": APEX + "/DASHY.md"}}, False),
        ("a foreign session writing a .env (must STILL DENY -- universal)", {
            "tool_name": "Write", "cwd": APEX,
            "tool_input": {"file_path": APEX + "/.env"}}, True),
        # --- Codex, 2026-10-05 (.codex/hooks.json runs this guard with --harness codex). Its file
        # --- edits arrive as apply_patch, the patch text in tool_input.command; every file the
        # --- patch adds, updates, deletes or moves to is checked. Codex may not edit the law that
        # --- binds it, its own harness, or the gates that judge its work.
        ("codex patch adding a file in the APEX tree", patch(here, "*** Add File: " + APEX + "/notes.md\n+x"), True, "codex"),
        ("codex patch to the machine's Codex config", patch(here, "*** Update File: /home/dashy/.codex/config.toml\n@@\n-a\n+b"), True, "codex"),
        ("codex patch adding a keypair under keys/, by a relative path", patch(here, "*** Add File: keys/devnet-agent.json\n+[1,2,3]"), True, "codex"),
        ("codex patch moving a file into the intake drop", patch(here, "*** Update File: README.md\n*** Move to: Docs-Dashy-Drop/README.md\n@@\n-a\n+b"), True, "codex"),
        ("codex patch whose second file is a .env", patch(here, "*** Update File: README.md\n@@\n-a\n+b\n*** Add File: .env\n+X=1"), True, "codex"),
        ("codex patch to AGENTS.md, the law that binds it", patch(here, "*** Update File: AGENTS.md\n@@\n-a\n+b"), True, "codex"),
        ("codex patch to its own hooks", patch(here, "*** Update File: .codex/hooks.json\n@@\n-a\n+b"), True, "codex"),
        ("codex patch to a gate (session_close.py)", patch(here, "*** Update File: tools/session_close.py\n@@\n-a\n+b"), True, "codex"),
        ("codex patch adding a git hook", patch(here, "*** Add File: .git/hooks/pre-commit\n+exit 0"), True, "codex"),
        ("codex patch to ordinary Solanaut files (must be ALLOWED)", patch(here, "*** Update File: packages/sdk/src/guard.ts\n@@\n-a\n+b\n*** Add File: runs/2026-10-05-x.md\n+# x"), False, "codex"),
        ("codex patch whose text names APEX, to a Solanaut file (must be ALLOWED)", patch(here, "*** Add File: runs/2026-10-05-y.md\n+Nothing is written under " + APEX + "/ or ~/Work."), False, "codex"),
        ("codex patch naming no file denies", patch(here, "@@\n-a\n+b"), True, "codex"),
        ("codex patch with no readable text denies", {
            "tool_name": "apply_patch", "cwd": here, "tool_input": {}}, True, "codex"),
        ("codex bash as an argument list, rm in APEX", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": ["rm", "-rf", APEX + "/DASHY.md"]}}, True, "codex"),
        ("codex bash sed -i on AGENTS.md", {
            "tool_name": "Bash", "cwd": here,
            "tool_input": {"command": "sed -i 's/a/b/' AGENTS.md"}}, True, "codex"),
        ("claude editing AGENTS.md: the Codex-only rule must not apply (must be ALLOWED)", {
            "tool_name": "Edit", "cwd": here,
            "tool_input": {"file_path": here + "/AGENTS.md"}}, False),
    ]
    print()
    print("boundary_guard.py --selftest")
    print("=" * 74)
    failed = 0
    for label, payload, expect, *rest in cases:
        got, reason = decide(payload, harness=rest[0] if rest else "claude")
        ok = got == expect
        failed += not ok
        print(f"  [{'PASS' if ok else 'FAIL'}]  "
              f"{'DENY  ' if got else 'allow '} {label}")
        if not ok:
            print(f"          expected {'DENY' if expect else 'allow'}. "
                  f"{reason[:130]}")

    # The three cases that separate this guard from protect-mcp.
    print("-" * 74)
    broken = [
        ("POLICY DELETED", OFFICE / "does-not-exist.toml", None),
        ("POLICY UNPARSEABLE", None, "this is not [ valid toml"),
        ("POLICY EMPTY (no rules)", None, '[meta]\nversion = "1"\n'),
    ]
    scratch = OFFICE / ".boundary_selftest.tmp.toml"
    for label, path, content in broken:
        if content is not None:
            scratch.write_text(content, encoding="utf-8", newline="\n")
            path = scratch
        got, _ = decide({"tool_name": "Write", "cwd": here,
                         "tool_input": {"file_path": here + "/kb/REGISTRY.md"}},
                        policy_path=path)
        failed += not got
        print(f"  [{'PASS' if got else 'FAIL'}]  "
              f"{'DENY  ' if got else 'allow '} {label} -> must deny")
    if scratch.exists():
        scratch.unlink()
    print("          protect-mcp permits in all three. That is the whole point.")

    print("-" * 74)
    total = len(cases) + len(broken)
    print(f"  {total - failed}/{total} cases passed")
    if failed:
        print("  GUARD IS NOT TRUSTWORTHY -- do not wire it until this is green.")
        return 1
    print("  guard behaves as specified")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Office boundary guard (PreToolUse).")
    ap.add_argument("--selftest", action="store_true", help="run the fault matrix")
    ap.add_argument("--explain", action="store_true", help="what it can/cannot see")
    ap.add_argument("--harness", choices=HARNESSES, default="claude",
                    help="the agent harness calling the hook; rules marked for one harness bind only it")
    args = ap.parse_args()

    if args.explain:
        print(EXPLAIN)
        return 0
    if args.selftest:
        return selftest()

    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        return emit_deny(f"BOUNDARY GUARD (fail-closed): could not read the hook "
                         f"payload ({e}). Refusing rather than guessing.")
    if not isinstance(payload, dict):
        return emit_deny("BOUNDARY GUARD (fail-closed): hook payload was not "
                         "an object.")

    try:
        denied, reason = decide(payload, harness=args.harness)
    except Exception as e:
        # A hook that crashes exits 1, and both harnesses read that as "proceed". The guard's
        # own failure is therefore a denial, like every other state it cannot vouch for.
        return emit_deny(f"BOUNDARY GUARD (fail-closed): the guard itself failed "
                         f"({type(e).__name__}: {e}). Refusing rather than guessing.")
    if denied:
        return emit_deny(reason)
    return 0


if __name__ == "__main__":
    sys.exit(main())
