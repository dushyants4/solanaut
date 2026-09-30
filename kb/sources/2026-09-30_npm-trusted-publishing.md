---
type: source
status: current
url: "https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/"
title: "npm trusted publishing with OIDC is generally available"
publisher: "GitHub (changelog)"
published: "2025-07-31"
fetched: 2026-09-30
checked: first-hand
created: 2026-09-30
updated: 2026-09-30
---

# npm trusted publishing, and provenance by default

The release standard that milestone R.4 adopts.

## Key facts

- Generally available on July 31, 2025.
- It lets CI publish to npm without long-lived tokens, through OpenID Connect.
- "the npm CLI automatically generates and publishes provenance attestations for your package."
- Supported: GitHub Actions on GitHub-hosted runners, and GitLab CI/CD on gitlab.com shared runners.
- It needs npm CLI v11.5.1 or later.

## What it supports

- `docs/READINESS.md`, R.4 and the security programme.
- [kb/wiki/security/readiness-standards.md](../wiki/security/readiness-standards.md).

## Caveats

- Publishing stays T4: the human presses it.
