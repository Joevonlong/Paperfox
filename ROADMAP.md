# Roadmap

Themes, not promises: there are no dates. Concrete tasks live in
[issues and milestones](https://github.com/Joevonlong/PaperTrail/milestones). Ideas go to
[Discussions › Ideas](https://github.com/Joevonlong/PaperTrail/discussions/categories/ideas).

## Now: v0.2.0, the first public release

- A public demo instance that only replays recorded runs (no keys, live endpoints disabled).
- Persistence: research questions and notes survive container upgrades; a schema version baseline.
- `/api/health` reports the version from `package.json`.
- Container hardening: configurable bind address, license and source labels in the image.
- Tooling to capture README screenshots and GIFs reproducibly.
- A test that enforces the dependency direction in [docs/architecture.md](docs/architecture.md#dependency-direction).

## Next

- Offline ranking regression tests, so `pnpm test` catches score changes without keys.
- An end-to-end check of the demo build in CI.

## Later

- More search sources (see [docs/adding-a-source.md](docs/adding-a-source.md)).
- A citable archived release (DOI) alongside [CITATION.cff](CITATION.cff).

## 1.0

1.0 comes when data migrations are stable and two MINOR releases in a row had no breaking changes
(see [CONTRIBUTING.md § Versioning](CONTRIBUTING.md#versioning)).
