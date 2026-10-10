# Node 24 installed compatibility of the prepared D40 patch

Builder-authored local evidence, 2026-10-10 Toronto, Linux x86-64,
already installed Node 24.19.0. Reviewed base 69ada72, original product unchanged.
The exact preserved D40 archive from S121 is installed offline in a fresh
temporary consumer with scripts disabled and no package symlink.

All six raw-buffer boundary cases pass through the installed public wallet
export, using the archived candidate test snapshot. Repository guard, base58
and transaction builders remain support, verified against the candidate manifest.
This is not an external-developer or clean Ubuntu installation study.

In the installed package, remove each private legacy-message, versioned-message
or wire copy separately. All three complete six-case trials fail assertions,
with no cancellation, skip, todo or setup-failure credit. Restore exact bytes
after each trial and on every exit; the final six-case control passes. The
helper verifies the archive, test snapshot and installed implementation hashes.
Temporary installation is removed; source and earlier runtime evidence stay intact.

```bash
mise exec node@24.19.0 -- uv run --script evals/release/node24-buffer/run.py
```

Equivalent regenerating command with that already installed Node runtime selected:
`uv run --script evals/release/node24-buffer/run.py`. The helper refuses other
versions; no runtime installation or default change is needed.

Raw installation, initial/restored controls, fault output and runtime/archive
summary are in node24-buffer/. The archive digest is
`55e8753409bb04960271418e1a3d907b8f3130ff16c10a0a143080be50af489d`.
No runtime installation/global change, full native/coverage matrix, independent
security, isolated signer, milestone or stable-release qualification follows.
H11 native/AST failures remain; D40 stays an unapplied patch, not current product.
