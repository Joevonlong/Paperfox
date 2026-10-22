# PaperTrail: notes for coding agents

PaperTrail starts from a research question and the papers a researcher already trusts, and builds a graded library of
related papers with the evidence behind every score. The repo has three parts:

- `client/`: Vue 3, Pinia, CodeMirror 6 and d3, in a Zettlr-style Markdown workspace.
- `server/`: a Hono API on Node 22 that queries OpenAlex, PubMed, Europe PMC, Crossref, arXiv, Tavily and SerpAPI,
  and calls OpenAI-compatible models (Nebius Token Factory by default).
- `shared/`: the zod contracts both sides use.

Data is stored in SQLite and plain files. The license is GPL-3.0-or-later.

## Setup & commands

```bash
corepack enable pnpm    # Node 25+: `npm i -g corepack` first; full guide: docs/development.md
pnpm install
cp .env.example .env.local   # maintainers only (optional keys); everything runs without them
```

| Command | What it does |
|---|---|
| `pnpm dev` | Server on :3001 (watch) and Vite client on :5173 |
| `pnpm dev:server` / `pnpm dev:client` | One side only |
| `pnpm build` | Client (Vite) and server bundle (tsup) into `dist/` |
| `pnpm start` | Serves `dist/` (default port 3000; set `PORT`) |
| `pnpm typecheck` | `vue-tsc` over client, server and shared |
| `pnpm test` | Vitest, offline |
| `pnpm gate` | typecheck + test + build. Run it before every PR. |
| `pnpm hygiene` | Repository rules CI enforces (local paths, env files, large files, ...): [CONTRIBUTING.md#hygiene](CONTRIBUTING.md#hygiene) |

- `scripts/docker-local.sh` builds and runs the Docker image on http://localhost:3040.
- Add `?demo=1` to any app URL to replay a recorded real run. It needs no keys and no network.
- `GET /api/health` lists the models and whether the Token Factory, Tavily and OpenAlex keys are set (never the values).

## Invariants

- **Everything works without keys.** AI functions in `server/ai/` return `null` or `[]` when a key is missing or a
  call times out. The pipeline then skips that stage or falls back, and says so in the stage event. Tavily and
  SerpAPI are skipped without their keys.
- **Demo mode must keep working** with no keys and no network (`server/demo/recordings/`, `server/routes/demo.ts`).
- **Only measured numbers** go into the UI and the README. Label anything illustrative.
- **Never print, log or commit `.env.local`** or any key. Traces scrub secrets from URLs. Keep it that way.
- **Never scrape** Google Scholar or any site. Use official APIs only.
- **Nothing is hard-deleted** from the workspace. Deletes move folders to `.trash/`.
- Tests stay offline: use recorded responses, never live APIs.

## Where things are

| Topic | Read |
|---|---|
| How the parts fit: the two flows, search sources, contracts, storage, dependency direction | [docs/architecture.md](docs/architecture.md) |
| What each feature does, its invariants and non-goals | [docs/features/README.md](docs/features/README.md) |
| Adding a library search source | [docs/adding-a-source.md](docs/adding-a-source.md) |
| `D-xx`, `CR-n` and other ids in code comments | [docs/adr/0001-early-design-decisions.md](docs/adr/0001-early-design-decisions.md) |
| Code and data from other projects | [docs/third-party.md](docs/third-party.md) |
| Environment setup, local data folders, recorded data, evaluation levels | [docs/development.md](docs/development.md) |
| Which paths trigger `needs-eval` / `contract-change` | [.github/labeler.yml](.github/labeler.yml) |
| Ranking evaluation and its results | [eval/](eval/) (`RESULTS_LIBRARY.md`, `RESULTS_SEED_PIPELINE.md`) |

Comments also cite early task ids (`CR-n`, `E-n`, `F-n`, `J-n`, `Q-n`, `Q2-n`, `R-n`, `V-n`); the same ADR explains them.
Do not add new ones. Link an issue or an ADR instead.

## Contracts

`shared/contracts.ts` (seed discovery), `shared/library.ts` (Library mode, chat, history) and `shared/config.ts`
(run presets) define every request, event and stored record.

- **Additive changes** need a note in the PR description. Examples: a new optional field, a new enum value
  such as a `SourceName`, a new optional env var.
- **Breaking changes** need an ADR in `docs/adr/` (copy `0000-template.md`) and maintainer agreement. Examples:
  removing or renaming a field, making a field required, changing a meaning or a default. The full definition is in
  [CONTRIBUTING.md#versioning](CONTRIBUTING.md#versioning); breaking PR titles carry `!`.
- When behaviour changes, update the matching `docs/features/<slug>.md` in the same PR.

## Picking work

Follow the decision table in [CONTRIBUTING.md § Finding something to work on](CONTRIBUTING.md#finding-something-to-work-on).
Do not start on an issue assigned to someone else.

## If you are an agent working from a fork

- You need no keys. Do not read, create or ask for `.env.local` or any secret.
- Verify only with `pnpm gate` (and `pnpm hygiene`). Do not run `eval/`, record demos, regenerate `docs/media/`,
  or edit `CHANGELOG.md`.
- PR titles use Conventional Commits and must match
  `^(feat|fix|perf|refactor|docs|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: .+`.

## AI / ranking changes

Changes to search, labels, scoring, the pass rule, prompts or models can move results in ways tests do not catch.
Maintainers run the hold-out evaluation for those PRs. Do not run `eval/library_eval.ts` yourself, because it needs
keys and spends API budget. In the PR, say which ranking behaviour you expect to change and why.

## PRs

- Fill in [.github/pull_request_template.md](.github/pull_request_template.md); say whether AI tools helped.
- The author is responsible for every line and must be able to explain it in review.
- CI must pass `gate`, `hygiene` and `pr-title`. PRs are squash-merged. Details: [CONTRIBUTING.md](CONTRIBUTING.md#pull-requests).

## Provenance

Files derived from Zettlr (GPL-3.0) keep their original header comment, or a comment naming the upstream file.
Keep those headers when editing. If you port new third-party code, name its source in a header comment and add it
to `docs/third-party.md`.
