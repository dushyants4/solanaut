# boundary_guard — the fault matrix, before and after

`uv run --script tools/boundary_guard.py --selftest`, 2026-09-27.

## 1. The territorial rules were needed

With a **draft** policy holding only the secrets rule, 14 cases failed, each one a write the
Solanaut policy exists to stop:

```
  [FAIL]  allow  write into the APEX tree
  [FAIL]  allow  write through the ~/Work symlink into APEX
  [FAIL]  allow  ..-traversal from Solanaut into APEX
  [FAIL]  allow  write the APEX VS Code workspace file
  [FAIL]  allow  write into another project (Dashy Personal)
  [FAIL]  allow  write APEX's Claude memory
  [FAIL]  allow  write the user-level Claude settings
  [FAIL]  allow  write into the shared plans folder
  [FAIL]  allow  write the Codex config
  [FAIL]  allow  write into the intake drop (read-only, byte for byte)
  [FAIL]  allow  bash rm inside APEX
  [FAIL]  allow  bash cp into ~/Work
  [FAIL]  allow  bash redirect into APEX
  [FAIL]  allow  missing cwd falls back to full enforcement (must DENY)
  19/33 cases passed
```

## 2. The guard itself had a gap: quoted redirect targets

With the full policy, one case still failed: `echo x > '<the Gubernaut workspace>/x.md'` was
**allowed** (32 of 33). The Office's redirect pattern refused any target that starts with a
quote, to keep prose like `echo "x >"` from reading as a write. But the Gubernaut workspace's
path contains spaces, so every shell redirect into it must be quoted: the one redirect this
policy exists to stop was the one shape the guard could not see.

**Fix:** a target may start with a quote when something follows the quote. A new case proves the
prose false positive stays closed (`git commit -m "... under /home/dashy/Work >"` is allowed).

**The Office's copy has the same gap.** Its paths are written through `~/Work` (no spaces), but
their resolved spellings are inside the APEX folder, which has spaces. Written up for the human
in `runs/2026-09-27-setup.md`; not fixed from here (isolation).

## 3. After

```
  [PASS]  DENY   write into the APEX tree
  [PASS]  DENY   write through the ~/Work symlink into APEX
  [PASS]  DENY   ..-traversal from Solanaut into APEX
  [PASS]  DENY   write the APEX VS Code workspace file
  [PASS]  DENY   write into another project (Dashy Personal)
  [PASS]  DENY   write APEX's Claude memory
  [PASS]  DENY   write the user-level Claude settings
  [PASS]  DENY   write into the shared plans folder
  [PASS]  DENY   write the Codex config
  [PASS]  DENY   write into the intake drop (read-only, byte for byte)
  [PASS]  allow  write Solanaut's OWN Claude memory (must be ALLOWED)
  [PASS]  allow  ordinary Solanaut write
  [PASS]  allow  relative Solanaut write
  [PASS]  DENY   write a .env
  [PASS]  DENY   write a Solana keypair by name
  [PASS]  DENY   write into keys/
  [PASS]  DENY   write the default CLI wallet shape (id.json)
  [PASS]  DENY   write a private key
  [PASS]  DENY   bash rm inside APEX
  [PASS]  DENY   bash cp into ~/Work
  [PASS]  DENY   bash redirect into APEX
  [PASS]  allow  prose ending in '>' before a closing quote, naming a protected path (must be ALLOWED)
  [PASS]  allow  bash READ outside Solanaut is not this guard's job (settings deny it)
  [PASS]  allow  bash write inside Solanaut
  [PASS]  allow  bash commit message, mandated trailer, mentions .env in prose (must be ALLOWED)
  [PASS]  allow  unguarded tool passes through
  [PASS]  DENY   malformed tool_input denies
  [PASS]  DENY   missing file_path denies
  [PASS]  DENY   missing cwd falls back to full enforcement (must DENY)
  [PASS]  allow  a foreign session writing its own repo (must be ALLOWED, not Solanaut's call)
  [PASS]  DENY   a foreign session writing a .env (must STILL DENY -- universal)
  [PASS]  DENY   POLICY DELETED -> must deny
  [PASS]  DENY   POLICY UNPARSEABLE -> must deny
  [PASS]  DENY   POLICY EMPTY (no rules) -> must deny
  34/34 cases passed
  guard behaves as specified
```
