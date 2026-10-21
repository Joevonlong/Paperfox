# Features

This is the list of user-facing features on `main`. Each spec describes **current behaviour**, the
**invariants** a change must keep, and **non-goals**. Acceptance criteria for new work go in the issue,
not here. For how the pieces fit together, see [../architecture.md](../architecture.md).

Stability:

- **stable**: covered by tests and documented here. Changes need a note in the PR, and breaking changes need an ADR.
- **experimental**: works, but behaviour and API may change without an ADR.
- **legacy**: kept for compatibility and evaluation. No new features; bug fixes only.

| ID | Name | Spec | Since | Stability |
|---|---|---|---|---|
| library-build | Library build (question → ranked library) | [library-build.md](library-build.md) | 0.1.0 | stable |
| quality-score | Quality score, pass rule and LLM read | [quality-score.md](quality-score.md) | 0.1.0 | stable |
| question-folders | Research question folders on disk | [question-folders.md](question-folders.md) | 0.1.0 | stable |
| seed-import | Seed import (ids, BibTeX, RIS, CSL JSON, CSV, PDF) | [seed-import.md](seed-import.md) | 0.1.0 | stable |
| library-history | Saved libraries per question | [library-history.md](library-history.md) | 0.1.0 | stable |
| graph-view | Graph view of notes and library papers | [graph-view.md](graph-view.md) | 0.1.0 | stable |
| vault-export | Literature notes and bibliography export | [vault-export.md](vault-export.md) | 0.1.0 | stable |
| demo-mode | Demo mode (`?demo=1`, recorded run) | [demo-mode.md](demo-mode.md) | 0.1.0 | stable |
| library-chat | Library chat with proposals | [library-chat.md](library-chat.md) | 0.1.0 | experimental |
| seed-discovery | Seed-based discovery (`/api/runs`, lanes) | [seed-discovery.md](seed-discovery.md) | 0.1.0 | legacy |

Ids such as `D-27` or `CR-11` in code comments are explained in [../adr/0001-early-design-decisions.md](../adr/0001-early-design-decisions.md).
