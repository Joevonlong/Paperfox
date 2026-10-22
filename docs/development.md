# Development setup

This is the one place that describes how to set up PaperTrail for development. You need no API keys for any of it.

## Requirements

- **Node 22.13 or newer.** `.node-version` says `22`, which version managers such as fnm or mise pick up.
  CI tests Node 22 and the current Node release.
- **pnpm**, in the exact version pinned by `packageManager` in `package.json`. Do not install a version by hand;
  let corepack (bundled with Node up to 24) switch to it:

  ```bash
  corepack enable pnpm
  ```

  Node 25 and newer no longer bundle corepack. Install it first: `npm i -g corepack`, then `corepack enable pnpm`.
  If you already have pnpm 10 or newer installed globally, it reads `packageManager` and switches to the pinned
  version by itself.
- **git.** Docker is optional.

## Install

```bash
git clone https://github.com/Joevonlong/PaperTrail.git && cd PaperTrail
pnpm install
```

No extra flags are needed. `pnpm-workspace.yaml` allows install scripts only for `better-sqlite3` and `esbuild`;
pnpm blocks every other dependency's install script. CI runs `pnpm install --frozen-lockfile`.

API keys are optional. To add some, copy `.env.example` to `.env.local` and fill in what you have. Never commit
`.env.local` or paste keys into issues.

## Run

| Command | What it does |
|---|---|
| `pnpm dev` | API server on http://localhost:3001 (`tsx watch`) and the Vite client on http://localhost:5173, which proxies `/api` to :3001 |
| `pnpm dev:server` / `pnpm dev:client` | One side only |
| `pnpm build` | Client (Vite) and server bundle (tsup) into `dist/` |
| `pnpm start` | Serves `dist/` on `PORT` (default 3000) |
| `scripts/docker-local.sh` | Builds the Docker image and runs it on http://localhost:3040 (`HOST_PORT` changes this) |

`scripts/docker-local.sh` needs a `.env.local` file in the repo or one of its parent folders; a copy of `.env.example`
with empty keys is enough. It mounts `data/` and `logs/` next to that file. The image does not yet persist
`WORKSPACE_DIR`; see [architecture.md § Storage](architecture.md#storage).

## Without keys

- Add `?demo=1` to any app URL to replay a recorded real run. It needs no keys and no network.
- Without `TOKEN_FACTORY_API_KEY`, AI steps are skipped or fall back (for example keyword overlap instead of
  embeddings), and each stage says so. Without `TAVILY_API_KEY` or `SERPAPI_KEY`, those sources are skipped.
- `GET /api/health` shows which keys the server loaded, never their values.
- In dev builds, `?mock=1` uses the recorded OpenAlex fixtures instead of the API. `LIBRARY_FIXTURE=1` makes the
  server build libraries from those fixtures instead of searching live.

## Checks

| Command | What it does |
|---|---|
| `pnpm gate` | `pnpm typecheck` + `pnpm test` + `pnpm build`. Run it before every PR; CI runs the same. |
| `pnpm typecheck` | `vue-tsc` over client, server and shared |
| `pnpm test` | Vitest. Offline: tests use recorded responses, never live APIs. |
| `pnpm hygiene` | The repository rules from [CONTRIBUTING.md § Hygiene](../CONTRIBUTING.md#hygiene), over the whole tree |
| `bash scripts/check-hygiene.sh --range upstream/main...HEAD` | The same rules, only for what your branch adds (this is what CI runs on a PR) |

On a fork, add the main repository as `upstream` first:
`git remote add upstream https://github.com/Joevonlong/PaperTrail.git && git fetch upstream`.

## Local data

Three folders hold local state. Each defaults to a path relative to the current directory, so every checkout or
git worktree gets its own:

| Variable | Default | Holds |
|---|---|---|
| `DATA_DIR` | `./data` | SQLite and the HTTP response cache. Safe to delete; it is refilled on demand. |
| `WORKSPACE_DIR` | `./workspace` | Research questions, notes and libraries. This is user data. |
| `LOG_DIR` | `./logs` | Per-run traces in `runs/<id>/`. Check these first when a score is missing. |

All three are git-ignored. The server looks for `.env.local` (and `.env`) in the current folder and up to seven
parent folders, so a worktree inside the main checkout uses the same keys. Point `DATA_DIR` at a shared absolute
path if you want several checkouts to share one API cache. Details: [architecture.md § Storage](architecture.md#storage).

## Recorded data

| Path | What it is | Who updates it |
|---|---|---|
| Inline constants in tests (for example `ATOM` in `server/library/sources/sources.test.ts`) | Recorded API responses for parser tests | Anyone adding a parser test |
| `server/demo/fixtures/*.json` | OpenAlex records from a real run, for tests, `?mock=1` and `LIBRARY_FIXTURE=1` | Maintainers |
| `server/demo/recordings/*.json` | Real recorded runs replayed by demo mode | Maintainers |

Recordings are real runs, never hand-edited numbers. Re-recording needs keys and a running server
(`pnpm exec tsx scripts/record-library.ts`, `pnpm exec tsx scripts/record-demo.ts`), so maintainers do it.
`pnpm exec tsx server/demo/validate.ts` checks every recording against the contracts. Each file must stay under
5 MB (the hygiene check rejects larger files).

## Evaluation

Search and ranking changes can move results in ways unit tests do not catch. There are three levels:

1. **Offline tests** (`pnpm test`). This is all contributors run. Offline re-scoring fixtures are planned, so that
   score regressions show up here too.
2. **Hold-out evaluation** (`eval/library_eval.ts`, results in `eval/RESULTS_LIBRARY.md`). It calls live APIs, needs
   keys and spends API budget. Maintainers run it for PRs labelled `needs-eval` through the `eval` workflow
   ([`.github/workflows/eval.yml`](../.github/workflows/eval.yml)), which evaluates one exact commit and names the run
   `eval <commit>`. Do not run it yourself.
3. **Release check.** If any `needs-eval` PR was merged, or the `ai` / `@ai-sdk/*` packages were upgraded since the
   last release, maintainers run the hold-out evaluation on the release commit before tagging.

`pnpm exec tsx scripts/smoke-models.ts` and `scripts/smoke-e2e.ts` check live model keys. They are for key
holders only.

## Releases

The lead cuts releases by pushing a `vX.Y.Z` tag. [`.github/workflows/release.yml`](../.github/workflows/release.yml)
then builds the container image for amd64 and arm64, runs `scripts/release/smoke.sh` against each image, and
publishes the image to GHCR and a GitHub Release whose notes come from `CHANGELOG.md`. To build the same image
from source:

```bash
git checkout vX.Y.Z
docker build -t papertrail:X.Y.Z .
```
