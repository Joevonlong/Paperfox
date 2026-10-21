# Library build

A library is a ranked list of papers built for one research question from the question text and the notes
and seeds in that question's folder. Code: `server/library/pipeline.ts` (`runLibrary`), contracts in
`shared/library.ts`, UI in `client/src/library/`.

## Current behaviour

`POST /api/library` takes a `LibraryRequest` and returns `{ libraryId }`. Progress streams as `LibraryEvent`s over SSE
(`GET /api/library/:id/stream`, replay then live). The stages run in this order:

1. **Goals** (`server/library/goals.ts`). Paper ids written in the notes (DOI, PMID, arXiv id, OpenAlex `W…`) become
   `knownPapers`. One planner-model call turns the question and notes into subtopics and keyword groups. Without a
   key, or on timeout, a deterministic fallback builds them from headings and TF-IDF terms.
2. **Search** (`gather()` in `server/library/sources/index.ts`). The query plan is the question, each subtopic, and
   the keyword groups, de-duplicated. Sources:
   - OpenAlex: 50 results per page, with a second page for subtopics.
   - PubMed: esearch with `retmax` 40, then efetch.
   - arXiv: 30 results, at most one request at a time, spaced by `ARXIV_MIN_INTERVAL_MS` (default 1000 ms).
   - Tavily: 10 results, advanced depth for subtopics, at most 25 calls. Skipped without `TAVILY_API_KEY`.
   - Google Scholar: through SerpAPI only. Skipped without `SERPAPI_KEY`.

   Known papers are expanded through their references, the papers citing them, and PubMed similar articles.
   The whole search has a time budget (`LIB_SEARCH_BUDGET_MS`, default 20 s). Calls still running when it ends
   are recorded as skipped.
   Hits are resolved to OpenAlex works, with Europe PMC and arXiv as fallbacks. They are then de-duplicated, capped
   at `maxCandidates` (default 600), and enriched with venue and author records.
3. **Citation and venue fallback.** When OpenAlex has no record for a paper, Europe PMC or Crossref supply the
   cited-by count, and venues are matched to cached OpenAlex sources by ISSN or name. Turn it off with `CITES_FALLBACK=0`.
4. **Labels and relevance** (`server/library/labels.ts`). Deterministic labels: kind, study design (from PubMed
   publication types), peer review, open access, field, recency, subtopics and found-by. Relevance is the
   embedding cosine to the question and subtopics, for up to 800 papers. Without embeddings, keyword overlap is
   used instead. The `label` stage message names the method that was used.
5. **Score**: see [quality-score.md](quality-score.md).
6. **LLM read**: the judge model reads title and abstract. See [quality-score.md](quality-score.md).
7. **Re-score and select**: passed papers come first, then by total.
8. **References fallback.** Europe PMC fills in reference lists when OpenAlex has none. Turn it off with `EPMC_REFS=0`.
9. **Files and report.** The top `topK` papers (default 30) are sent to the client. Files are written to the
   question folder ([question-folders.md](question-folders.md)) and traces to `${LOG_DIR}/runs/<libraryId>/`.

The UI sends every source except Google Scholar (`UI_SOURCES` in `client/src/stores/library.ts`). The server
default in `LibraryRequest` still includes `scholar`.

## Invariants

- No key is required. Each AI or keyed step is skipped or falls back, and the stage event says which and why.
- A failing source never fails the build. It is recorded as a `SourceCall` with an `error`.
- A build reads only the notes and seeds of its own question (D-33).
- Every label and score component can be traced to a source record (OpenAlex, PubMed, Europe PMC, arXiv, Tavily, SerpAPI).
- New library search sources go in `server/library/sources/` ([../adding-a-source.md](../adding-a-source.md)).

## Non-goals

- Full-text download, PDF parsing of results, or OCR. Only metadata and abstracts are used.
- Scraping any site, including Google Scholar.
- Cross-question libraries.
