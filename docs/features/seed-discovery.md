# Seed-based discovery (legacy)

The first pipeline. It starts from 2–5 seed papers and sorts candidates into lanes. Since D-23 there is no UI for it,
but the API and the demo recording remain, and the hold-out eval in `eval/` measures it.
Code: `server/discovery/`, `server/ai/`, `server/sources/`. Contracts: `shared/contracts.ts`.

## Current behaviour

- `POST /api/runs` starts a run with a question, seed inputs and a preset (`demo` or `deep`, `shared/config.ts`,
  env-overridable, D-16). Progress streams from `GET /api/runs/:id/stream` (SSE). `GET /api/runs/:id` returns the snapshot.
- Stages:
  1. resolve seeds;
  2. candidate routes:
     - R1: references of the seeds;
     - R2: papers citing at least 2 seeds;
     - R3: PubMed similar articles;
     - R4: query expansion from facets;
     - Scout: Tavily, through the scout model;
  3. lanes;
  4. embed;
  5. rerank: embedding similarity to the question, because no reranker model is served (D-19);
  6. judge;
  7. verify quotes;
  8. order.
- **Date check.** An in-link from seed *s* to candidate *c* counts only if `year(c) ≤ year(s) + 1`. Otherwise it is
  dropped and logged.
- **Lanes** (`assignLane`), in precedence order:
  1. Retracted;
  2. NotAssessable: no abstract and fewer than 3 links;
  3. Core: at least 2 seed links;
  4. Fresh: published in the last `freshMonths` and fewer than 2 links;
  5. Linked: 1 link;
  6. Bridges: everything else.
- **Order within a lane.** Judged papers come first, sorted by 0.45·judge + 0.2·rerank percentile + 0.3·link
  percentile + 0.05·impact. Unjudged papers follow, by links and then citations; Bridges use the PubMed rank instead.
  Near-duplicates (cosine above 0.92) are pushed down.
- "Why ranked here" is built from features only. It is never LLM text.
- Papers, runs and embeddings are cached in SQLite (`${DATA_DIR}/papertrail.sqlite`, `server/data/repo.ts`).

## Invariants

- One failing route never fails the run. Each stage emits start and done, skipped or error, with counts and timing.
- Without keys, the model stages are skipped, and the graph routes still produce lanes.

## Non-goals

- New features. New discovery work goes into Library mode.
