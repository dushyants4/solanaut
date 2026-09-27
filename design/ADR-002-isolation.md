# ADR-002 · Isolation from the Gubernaut workspace

**Status:** accepted 2026-09-27.

## Context

Solanaut applies Gubernaut's patterns but must not carry its context. On this machine:

- `~/.claude/settings.json` enables **30 Gubernaut plugins** for every session (office,
  media-center, general, website), loaded from marketplaces inside the Gubernaut workspace (APEX);
- the Office's release, office-core `182b7a9`, carries APEX run records, `deploy/vps` and an APEX
  boundary policy, and its guard predates the 2026-09-03 fail-open fix;
- there is no ancestor `CLAUDE.md`, and Claude's auto-memory is already per path.

## Decision

Five layers:

1. **Location.** A sibling of APEX under `~/Projects`, not inside it.
2. **Plugins.** `.claude/settings.json` sets the 30 Gubernaut plugins to `false` for this project
   and enables only the `solanaut-*` seats, from this folder's own marketplace. The four generic
   plugins (Codex, frontend-design, plugin-dev, agent-sdk-dev) stay inherited.
3. **Enforcement.** The Office's guard, **vendored, not installed** (`plugins/VENDORED.md`), with
   Solanaut's own policy: writes into APEX, `~/Work`, `~/Lab`, other projects, machine-wide agent
   config, APEX's memory and the intake drop are denied; keys and `.env` everywhere. Reads of
   APEX are denied natively in `.claude/settings.json`.
4. **Own state.** Its own git and private remote, its own Codex trust entry, its own Chrome
   profile (`~/.cache/solanaut/chrome`), no use of the Solana CLI's global config.
5. **Gubernaut only as published artefacts.** `@gubernaut/core` from npm, and public pages by URL.

## Why vendor rather than install the Office

Installing office-core would import APEX context and the older guard, and its marketplace name
(`office`) collides with the one this machine already enables globally. Vendoring copies the
first-party seat content at pinned commits, renames it (`solanaut-office`, `solanaut-<seat>`),
and records the source; the cost is that it can drift from the Office, which the pins make
visible.

## Known limits

- The guard's Bash coverage is heuristic (`--explain` lists the bypasses). Reads via Bash
  (`cat`) are not covered by the settings' Read denies.
- The global SessionStart hook (herdr) still runs; it only reports session state, and only
  inside herdr.
- The guard found a real gap of its own on day one: a redirect to a **quoted** path, the only
  way to write into APEX (its path has spaces), was invisible. Fixed here, shown failing first;
  the Office's copy has the same gap (`evals/harness/boundary_guard.md`).
