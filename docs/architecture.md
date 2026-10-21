# Architecture

PaperTrail is one Node process that serves a JSON/SSE API (Hono) and a built Vue client. The client is a
Markdown workspace (CodeMirror 6, Pinia, d3) with a Library panel. The server talks to scholarly APIs and to
OpenAI-compatible model endpoints (Nebius Token Factory by default). The behaviour of each feature is specified in
[features/](features/README.md). This page shows how the parts connect.

```
client/   Vue 3 app (workspace, editor, library UI, graph, chat)      → calls /api/*
server/   Hono API: routes → pipelines → sources / ai / data           → calls OpenAlex, PubMed, Europe PMC,
                                                                          Crossref, arXiv, Tavily, SerpAPI, models
shared/   zod contracts used by both sides
```

## The two flows

### Library mode (the main UI)

`POST /api/library` → `server/library/pipeline.ts` `runLibrary`:

```
goals (planner model or deterministic fallback)
  → search: gather() over the library sources + known-paper graph expansion
  → resolve to OpenAlex, dedupe, cap, enrich (venues, authors)
  → citation / venue fallback (Europe PMC, Crossref)
  → labels + relevance (embeddings or keyword overlap)
  → score → LLM read (judge model) → re-score + pass rule
  → references fallback → files + report
```

Events stream to the client as `LibraryEvent`s over SSE (`GET /api/library/:id/stream`). The client re-scores in the
browser when the user changes weights, the pass rule or filters. See [features/library-build.md](features/library-build.md)
and [features/quality-score.md](features/quality-score.md).

### Seed-based discovery (legacy, API only)

`POST /api/runs` → `server/discovery/pipeline.ts` `runPipeline`:

```
resolve seeds → R1 refs · R2 ≥2-seed citers · R3 PubMed similar · R4 query expansion · Scout (Tavily)
  → lanes → embed → rerank (embedding similarity) → judge → verify quotes → order
```

Events are `RunEvent`s over SSE (`GET /api/runs/:id/stream`). This flow has no UI. It is kept for the API, the demo
recording and the eval. See [features/seed-discovery.md](features/seed-discovery.md).

## Search sources

There are two source directories, one per flow:

| Directory | Used by | What it holds |
|---|---|---|
| `server/sources/` | Seed discovery, and as low-level clients for Library mode | `openalex.ts` (works, batches, cites filters), `pubmed.ts` (efetch, elink similar), `europepmc.ts` (abstract fallback), `tavily.ts` (search + identifier extraction) |
| `server/library/sources/` | Library mode only | `index.ts` (`gather()`, the query plan and the `runners` map), one file per search source (`openalex-lib.ts`, `pubmed-lib.ts`, `arxiv.ts`, `tavily-lib.ts`, `scholar.ts`), plus `normalize.ts`, `enrich.ts`, `openalex-entities.ts` (entity cache), `europepmc-lib.ts`, `citations-fallback.ts` |

Library sources call down into `server/sources/` (for example `openalex-lib.ts` uses `server/sources/openalex.ts`, and
`tavily-lib.ts` uses `server/sources/tavily.ts`). Nothing in `server/sources/` imports from `server/library/`.

**New library search sources go in `server/library/sources/`.** Follow [adding-a-source.md](adding-a-source.md).

All HTTP to scholarly APIs goes through `server/data/http.ts`. It provides the raw response cache, retry with backoff on
429/5xx, per-API concurrency limits, and a trace line per call.

## Contracts

| File | Covers |
|---|---|
| `shared/contracts.ts` | Seed discovery: `Paper`, `Seed`, `Candidate`, `RunEvent`, `RunSnapshot`, `RunRequest`, lanes, features, judgements |
| `shared/library.ts` | Library mode: `LibraryRequest`, `LibPaper`, `LibraryEvent`, labels, score components, weights, chat (`ChatRequest`, `Proposal`), history (`LibrarySummary`) and the HTTP API list |
| `shared/config.ts` | Seed-discovery run presets (`demo`, `deep`) and their env overrides |

Both sides validate with these zod schemas. Additive changes (an optional field, a new enum value, an optional
env var) need a note in the PR. Breaking changes need an ADR in [adr/](adr/).

## Storage

There are three roots, each set by an env var:

| Root | Default | Holds |
|---|---|---|
| `DATA_DIR` | `./data` | `papertrail.sqlite`: seed-discovery papers, ids, citations, provenance, runs, candidates, judgements, and the embedding cache. `raw/<api>/<sha256>.json.gz`: the HTTP response cache. `raw/openalex-entities.sqlite`: the OpenAlex entity cache. `raw/pubmed-rec/` and `raw/tavily/`: per-record and per-query caches. `library/<id>/`: libraries built without a question. |
| `WORKSPACE_DIR` | `./workspace` | One folder per research question: `Question.md`, `seeds/`, `notes/`, `libraries/<libraryId>/` (`goals.json`, `library.json`, `graph.json`, `papers/`, `chat.jsonl`), `exports/`. Deleted questions go to `.trash/`. |
| `LOG_DIR` | `./logs` | `runs/<id>/<channel>.jsonl` (api, llm, tavily, events, papers, relations, chat) and `summary.md`. Calls outside a run go to `server/<channel>.jsonl`. Secrets are scrubbed from URLs. |

- `DATA_DIR` is a cache: deleting it only costs re-fetching. `WORKSPACE_DIR` is user data. `LOG_DIR` is for debugging.
- The SQLite schema is plain SQL, created with `CREATE TABLE IF NOT EXISTS`. There are no migrations.
- The browser keeps the notes in IndexedDB as a write-through cache of the question folders. The server copy wins.
- Demo mode (`?demo=1`) reads `server/demo/recordings/` and never writes to the workspace.

**Known issue.** The Docker image sets only `DATA_DIR=/data`. `WORKSPACE_DIR` and `LOG_DIR` therefore resolve inside
the container (`/app/workspace`, `/app/logs`), and research questions do not survive a container rebuild unless you
set `WORKSPACE_DIR` to a mounted path. `scripts/docker-local.sh` mounts `data` and `logs` only.

## Dependency direction

```
client  ──→ shared
server/routes ──→ server/library, server/discovery, server/data, server/sources ──→ shared
server/library ──→ server/library/sources ──→ server/sources ──→ server/data
server/library, server/discovery ──→ server/ai ──→ server/data
```

- `shared/` imports nothing from `client/` or `server/`.
- `server/library/` and `server/discovery/` do not import each other.
- `server/sources/`, `server/ai/` and `server/data/` never import from `server/library/`, `server/discovery/` or `server/routes/`.
- The client reaches the server only over HTTP. The one exception is the dev-only mocks (`?mock=1`), which import
  JSON fixtures from `server/demo/fixtures/` and are left out of production builds.

## AI degradation

Every model call goes through `server/ai/` (`http.ts`, `embed.ts`, `judge.ts`, `planner.ts`, `scout.ts`). Without
`TOKEN_FACTORY_API_KEY`, or on a timeout, these return `null` or `[]`. The pipeline then skips that stage or falls
back, and says so in the stage event. Tavily and SerpAPI are skipped without their keys in the same way.

## Planned

- Persist `WORKSPACE_DIR` and `LOG_DIR` in the container image.
- A test that enforces the dependency direction above.
