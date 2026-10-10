# TOOLCHAIN.md — what Solanaut builds with, pinned

Checked by `uv run --script tools/doctor.py`, which fails on anything missing or off-pin.
Installed 2026-09-27 on `omarchy` (Omarchy Linux, x86_64).

| Tool | Pin | Installed by | Why this version |
|---|---|---|---|
| Node.js | **26.7.0** | mise (`mise.toml`, and the global mise config). `/usr/bin/node` is 26.8.1: it would also run, but it is not the pin, and the doctor says so | runs the TypeScript sources natively (type stripping, Node ≥ 22.6), so the SDK needs no build step to run or test |
| npm | 11.x | ships with node | workspaces; no pnpm or yarn on this machine, so none is assumed |
| Solana CLI (Agave) | **3.1.10** | Anza's installer, `~/.local/share/solana/install/` | **the release Anchor 1.2.0 selects.** 4.3.0, the latest stable on 2026-09-27, was installed first; the first `anchor` command switched the active release to 3.1.10 by itself. 4.3.0 stays installed and inactive |
| Anchor CLI | **1.2.0** | avm (`~/.avm/bin`), built from `otter-sec/anchor` at tag `v1.2.0` | latest on 2026-09-27. Proven on this machine: `anchor init` + `anchor build` produced an SBF program and ran its LiteSVM tests |
| platform-tools | v1.57 | fetched by `cargo-build-sbf` | whatever Agave 3.1.10 fetches |
| Rust | host stable (1.98.0) | rustup | host tools only; SBF programs build with platform-tools' own compiler |
| uv | 0.12.x | system | runs the Python tools in `tools/` (stdlib only) |
| Chrome | system | `/usr/bin/google-chrome-stable` | `tools/colosseum_entry.mjs` drives it over CDP |
| Obsidian | 1.13.7 (optional) | pacman | reads the repository as a knowledge vault (`design/ADR-007-knowledge-vault.md`). Nothing needs it to build or test, so the doctor does not check it |
| flock | `/usr/bin/flock`, util-linux 2.42.3 on this host | already installed; no installation performed | ADR-019 kernel-held writer ownership, using its inherited-descriptor interface. Ubuntu runner qualification tests its distribution version; no network filesystem support claimed |

## PATH

Local release qualification also uses already-installed Node 24.19.0/npm 11.17.0
through explicit `mise exec node@24.19.0 --` commands. No installation, global
configuration or development pin change is performed. Current-host evidence is
`evals/release/node24-current.md` (CLAIMS S100); clean Ubuntu and the complete
runtime matrix remain unqualified. The newer exact `701372e` follow-up is
`evals/release/node24-read-completion.md` (CLAIMS S104): no installation or pin
change, native/type/installed passes and a failed unchanged quiet AST wait.
The newest exact `4addaa4` candidate is recorded in
`evals/release/node24-owned-report.md` (CLAIMS S109): existing Node 24,
unchanged private artefact, no installation or pin change. Runtime passes and
failed coverage remain distinct; this does not qualify the complete matrix.

`~/.bashrc` carries one block, added 2026-09-27:

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
```

Anza's installer and `anchor` both append a PATH line to `~/.bash_profile` whenever they install a
release. It was removed twice, because `~/.bash_profile` already sources `~/.bashrc`. If it
reappears after an upgrade, it is a harmless duplicate.

Scripts never rely on the interactive PATH: npm scripts and `tools/` set it themselves.

## Anchor workspaces pin their toolchain

Evaluation dependency resolution: Stryker 10.0.0 retains typed-rest-client 2.3.1,
with a scoped qs 6.16.0 override in the root manifest/lockfile. Installed query
regressions and restoration evidence are in `evals/ci/dependency.md`. This does not
clear the remaining dependency advisories or qualify a full mutation score.

`anchor init` writes an empty `[toolchain]` table. Solanaut's workspace fills it, so no command
can switch the Solana release silently:

```toml
[toolchain]
anchor_version = "1.2.0"
solana_version = "3.1.10"
```

## v1 transactions and the test validator

v1 transactions went live on mainnet on 2026-09-15 and are live on devnet
([source](kb/sources/2026-09-30_solana-upgrades-larger-transactions.md)). A local validator runs them only from
Agave 4.2.2 ([source](kb/sources/2026-09-30_solana-dev-skill-transactions-v1.md)), so the pinned 3.1.10 cannot.

- **Keep 3.1.10 active.** Anchor 1.2.0 selects it for builds.
- **For v1 integration tests,** run the installed, inactive 4.3.0's `solana-test-validator` by its absolute path,
  never by switching the active release. Surfpool 1.5 or later also enables v1.
- **`tools/doctor.py` checks that validator** by its absolute path, at 4.2.2 or later. It was shown failing first
  against the 3.1.10 release (`evals/sdk/decode.md`).

## Keys

The Solana CLI's global config (`~/.config/solana/`) is never used. Every command passes `--url`
and `--keypair`, and devnet keys live in `keys/` (gitignored, and write-denied to agents by the
boundary guard).
