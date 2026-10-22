# Security policy

## Supported versions

Paperfox is pre-1.0. Only the latest `0.x` release gets security fixes; fixes ship as a new patch release, not as
backports.

| Version | Supported |
|---|---|
| Latest 0.x release | Yes |
| Older releases | No; please upgrade |

## Scope

In scope:

- The code in this repository (server, client, shared contracts, scripts and workflows).
- The container image built from this repository and published with a release.
- The public demo instance, once it is announced in the README. It runs in demo-only mode with no API keys.

Out of scope: vulnerabilities in the third-party services Paperfox calls (OpenAlex, PubMed, model providers and
others; report those to their owners), denial of service through ordinary traffic volume, and findings that need an
already compromised machine or a malicious `.env.local`.

## Reporting a vulnerability

Report privately through GitHub's
[private vulnerability reporting](https://github.com/Joevonlong/Paperfox/security/advisories/new). This is the
only channel: please do not open a public issue, discussion or pull request, and do not use email.

Include what you can: the affected version or commit, how to reproduce, the impact you expect, and any suggested fix.

## What happens next

| Step | Target |
|---|---|
| Acknowledge your report | within 7 days |
| Assess it and tell you whether we accept it | within 14 days |
| Release a fix for an accepted, exploitable issue | as soon as practical; we keep you updated at least every 14 days |

These are targets for a small volunteer team, not guarantees.

We use coordinated disclosure through a GitHub Security Advisory (GHSA):

1. An accepted report becomes a draft advisory on this repository, and you are invited to it.
2. The fix is developed in the advisory's temporary private fork. We request a CVE when it is warranted.
3. The patch release, the published advisory and the `Security` entry in [CHANGELOG.md](CHANGELOG.md) go out
   together. We credit you in the advisory unless you prefer otherwise.

Please keep the details private until the advisory is published. Hardening that is not exploitable is tracked in a
normal public issue instead.
