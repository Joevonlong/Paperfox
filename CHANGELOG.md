# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) as described in
[CONTRIBUTING.md § Versioning](CONTRIBUTING.md#versioning).

## [Unreleased]

### Added

- Continuous integration: `gate` (typecheck, tests and build on Node 22 and the current Node release), `hygiene`
  (repository rules and a gitleaks secret scan), `dependency-review` and a Conventional Commits PR title check.
- `pnpm hygiene` (`scripts/check-hygiene.sh`), which blocks local paths, environment files, SQLite databases, files
  over 5 MB and unsafe workflow triggers.
- Contributor documentation: `docs/architecture.md`, one spec per feature in `docs/features/`,
  `docs/adding-a-source.md`, `docs/third-party.md`, ADRs in `docs/adr/` and `docs/development.md`.
- Community files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`,
  `GOVERNANCE.md`, `MAINTAINERS.md`, `ROADMAP.md`, `CITATION.cff` and this changelog.
- GitHub configuration: bug report template, pull request template, label definitions, automatic `needs-eval` and
  `contract-change` PR labels, CODEOWNERS and Dependabot.

### Changed

- The pnpm version is pinned through `packageManager`; `pnpm install` works without extra flags. The Docker image
  installs pnpm with corepack.
- Node 22.13 or newer is required (`engines.node`), as the pinned pnpm needs it.
- Recorded OpenAlex data used by tests and dev mocks moved from `docs/data/` to `server/demo/fixtures/`.
- `AGENTS.md` and the README were rewritten for contributors.

### Removed

- Early planning notes, the task board and the deploy script. They remain in the git history of 0.1.0.

## [0.1.0] - 2026-10-18

The first working version: Library mode with multi-source search, six-component scoring with evidence, filters
and pass rule, graph view, library chat with proposals, question folders with seed import, vault notes and export,
and demo mode. There is no `v0.1.0` tag: this version is commit `d7c5dbc`, which also includes README updates made
until 2026-10-21.

[Unreleased]: https://github.com/Joevonlong/PaperTrail/compare/d7c5dbcc1864569d51b64aa80261662c1797a460...HEAD
[0.1.0]: https://github.com/Joevonlong/PaperTrail/tree/d7c5dbcc1864569d51b64aa80261662c1797a460
