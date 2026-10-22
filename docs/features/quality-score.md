# Quality score, pass rule and LLM read

Each scored paper gets six components, a total, a grade and a pass/fail flag. Every component carries a
`how` sentence and evidence lines with source links. Server: `server/library/score.ts`,
`server/library/llmread.ts`. The browser re-scores with the same rules in `client/src/library/score.ts`.

## Current behaviour

Each component has a value between 0 and 1, or `null` when it cannot be assessed. The weight of a `null` component
is redistributed over the assessed components:
`contribution_i = w_i × value_i / Σ_assessed w_j`.

| Component | Default weight | Value |
|---|---|---|
| relevance | 0.30 | Embedding cosine (or keyword overlap), min–max scaled within the library. |
| graph | 0.15 | Links to known papers from the notes (cites, cited by, PubMed similar): 0 papers = 0, 1 = 0.5, 2 or more = 1. |
| citations | 0.18 | Tried in order: OpenAlex `citation_normalized_percentile`. For papers under 2 years old, FWCI/(FWCI+1), or a neutral 0.5. Otherwise the percentile of log(cited_by+1) within the library. Last, the Europe PMC/Crossref fallback percentile among papers within ±1 year. |
| venue | 0.15 | 0.6·percentile of the source h-index + 0.2 core source + 0.1 journal/conference + 0.1 DOAJ or ISSN, rescaled over the available parts. Preprint servers and repositories get a fixed 0.2. |
| authors | 0.12 | 0.7·percentile of the higher h-index of the first and last author + 0.3 if an institution has a ROR id. |
| llm | 0.10 | (relevance + quality)/6 from the LLM read, ×0.6 if the quoted evidence is not found in the abstract. |

**Exclusions** (never pass, listed last): retracted, no title, duplicate of another record, already in your vault.

**Pass rule** (D-27, D-38). A paper passes when all three hold:

- it ranks in the top `topPercent`% (default 25) of the non-excluded papers by total;
- its total is at least `threshold` (default 0.50);
- the LLM read did not rate its relevance 0 or 1 out of 3.

A paper failing the last check is tagged "off-topic (LLM read)".

**Grades** (D-25): A ≥ 0.85, B ≥ 0.70, C ≥ 0.55, D ≥ 0.40, else E.

**LLM read** (D-32). The judge model reads the title and abstract of the top max(`llmReadTopK`, `topK`) papers,
capped at 60. After re-scoring, papers that newly entered that top and are not read yet get a read, for at most 5
extra rounds. Without `TOKEN_FACTORY_API_KEY` this stage is skipped, and the `llm` component is `null`.

Changing weights, the pass rule or filters in the UI (or applying a chat proposal) re-scores in the browser. It
does not rebuild the library.

## Invariants

- Scoring is deterministic given the same records, weights and LLM reads. `score.ts` has no I/O.
- The server and client implementations of the pass rule and grades must agree. Tests cover both.
- Every component explains itself (`how` and evidence). No unexplained number reaches the UI.
- Percentiles are within the current library and say "of N".

## Non-goals

- Learned or personalised weights.
- Scoring from full text.
- Feedback buttons (thumbs up/down) that change ranking.
