# ADR-0001: Early design decisions and task ids

- Status: accepted
- Date: 2026-10-18 (recorded here 2026-10-22)

## Context

The first version was built quickly, and its decisions were logged as `D-01`, `D-02`, and so on. Code comments
still cite them, for example `// D-27: pass rule`. Comments also cite ids of early tasks and fixes: `CR-n`
(change requests), `E-n` (enrichment tasks), `F-n` (build tasks), `J-n` and `Q-n` / `Q2-n` (review and QA fixes),
`R-n` (requirements) and `V-n` (visual tasks). The planning notes that defined those ids are no longer in the
repository.

This ADR keeps every id that code or configuration still cites, with a short explanation. When you see one in a
comment, look it up here. The task ids explain why a line exists, but they are not decisions.

New decisions get their own ADR (copy [0000-template.md](0000-template.md)). Do not add rows to this file, and do
not add new ids of these kinds to code. Link an issue or an ADR instead.

## Decisions

| ID | Decision | Reason |
|---|---|---|
| D-04 | Models on Nebius Token Factory: embeddings `Qwen/Qwen3-Embedding-8B` (1024 dims), reranker `Qwen/Qwen3-Reranker-8B`, judge `nvidia/Nemotron-3_5-Lightning`, planner and scout `nvidia/nemotron-3-super-120b-a12b`. Every model can be overridden by env (`.env.example`). | Open models that one provider serves, with verified 1024-dim support and tool calling. |
| D-16 | The seed pipeline has two run-size presets, `demo` and `deep` (`shared/config.ts`). Env vars can override every size. | A demo run had to finish in under about 45 s. Deeper runs stay possible without code changes. |
| D-18 | PaperTrail runs locally (`pnpm start`, or `scripts/docker-local.sh` on port 3040). There is no hosted deployment. | A local run keeps keys and research notes on the user's machine. A hosted deployment was postponed. |
| D-19 | Token Factory serves no reranker, so the rerank stage ranks by embedding similarity to the question and says so in its stage message. | The model is unavailable. A labelled fallback is better than a silent gap. |
| D-20 | Library mode builds a ranked library from multi-source search, deterministic labels and an evidence-backed quality score. | Seed-only discovery needs seeds first. Library mode starts from a question and notes. |
| D-21 | The UI does not offer Google Scholar. The server queries it only through SerpAPI and never scrapes it. Tavily is a high-priority source: the question, every subtopic and every keyword group, 10 results per query, advanced depth for subtopics, at most 25 calls per library. | No SerpAPI key was available, and scraping Scholar breaks its terms. Tavily finds recent web-hosted papers. |
| D-23 | Library replaces the seed-based Discover tab. Paper ids written in notes become `knownPapers`. `/api/runs` stays on the server without a UI. Demo mode replays a recorded Library run. | Two discovery UIs confused users. The seed pipeline is still useful as an API and an eval baseline. |
| D-24 | The graph view and the Library sidebar use one ink-on-paper visual style, with d3 for 2D layout and reduced motion respected. | One consistent visual language for the research views. |
| D-25 | Results show the verdict first: one plain sentence, strengths and a weakness, and a total. "Why this score" is a report card. Grades: A ≥ 0.85, B ≥ 0.70, C ≥ 0.55, D ≥ 0.40, else E. | A sentence and a grade are quicker to read than a stacked bar of six numbers. |
| D-26 | Chat has its own collapsible column on the right. History is kept per library. | Chat should not cover the results it talks about. |
| D-27 | Pass rule: a paper passes when it is in the top X% of the library (default 25%) and its total is at least the floor (default 0.50). Both values are adjustable in the UI and by chat proposals. | An absolute threshold passed almost everything in strong libraries and almost nothing in weak ones. |
| D-28 | The subtopic label lists only subtopics whose cosine is within 0.05 of the paper's best match and at or above the library's 60th percentile. Without embeddings, a subtopic needs at least 2 of its query terms (and at least half of them) in the paper. | Without this cut, every paper carried every subtopic label. |
| D-29 | Chat proposes changes to weights, the pass rule or filters as a diff with a rationale, and never applies them itself. The user clicks Apply; the list re-scores in the browser, and each applied change is logged. | The user stays in control, and every ranking change can be traced. |
| D-32 | The LLM read covers every paper returned to the UI: max(`llmReadTopK`, `topK`), capped at 60. Known papers get short titles. | Unread papers in the visible list made the LLM component look arbitrary. |
| D-33 | One folder per research question. The default vault is empty, and a build reads only the notes and seeds of its own question. This replaces D-20's "whole vault is one topic". | Mixing topics in one vault polluted goals and known papers. |
| D-34 | Results show as score tiles by default, with a table toggle. Both views show the same information. | Tiles scan well; the table compares well. |
| D-35 | Each question keeps a history of its libraries: open without rebuilding, rename, delete with a confirm step, export as JSON. | Builds take time and cost API calls, so it must be possible to reopen them. |
| D-36 | Seed import accepts pasted ids, BibTeX, RIS, CSL JSON, CSV or plain text, and PDFs (DOI taken from the first pages). | Researchers already keep references in these formats. |
| D-37 | Everything for one question lives in one folder on disk under `WORKSPACE_DIR`. The server is the source of truth, and the browser vault is a write-through cache. | Files on disk are easy to back up and to inspect, and other tools can use them. |
| D-38 | LLM off-topic gate: if the LLM read rates relevance 0 or 1 out of 3, the paper cannot pass. It stays listed with the tag "off-topic (LLM read)". | Off-topic papers with strong citation metrics were passing on metrics alone. |

## Task ids

Earlier tasks and fixes, in the words of the change they made. Later changes may have moved the code on.

| ID | What it was |
|---|---|
| CR-1 | Library mode: build a scored paper library per question from multi-source search, with Tavily web search as a high-priority source. |
| CR-3 | Real demo with no mock data: `?demo=1` replays a recorded real Library run; production never falls back to mock data. |
| CR-6 | Navigation fix: graph Back button and in-app back/forward history that restores the exact tab, scroll, zoom and selection. |
| CR-7 | QA fix batch (Q-1 to Q-14): bug fixes for reload, chat, counts, rounding, rank arrows, graph labels and keyboard shortcuts. |
| CR-8 | Obsidian-style inline note title above the body; editing it renames the note (for a question, its folder). |
| CR-9 | Clean production start: empty workspace, no sample question or topic-specific defaults; demo content only behind `?demo=1`. |
| CR-10 | Graph draws paper-to-paper citation edges from referenced works, matching seeds and notes by any id form. |
| CR-11 | "Why this score" shown as a chart: score donut, value bars, small donut in popover, mini stacked bar on tiles and rows. |
| CR-12 | Graph library nodes get a blue colour ramp that follows total score (darkest = highest), in addition to size. |
| CR-13 | Seed resolution falls back to Crossref, PubMed and Europe PMC when OpenAlex cannot answer, with a visible notice. |
| CR-14 | Citation and venue data without OpenAlex: Europe PMC/Crossref cited-by counts (year percentile) and cached-source venue matching. |
| E-1 | Citation edges between papers in the client graph, from referenced works and cites/cited-by relations, matched by any id. |
| E-2 | Europe PMC reference-list fallback for passed papers when OpenAlex returned no referenced works; time-boxed and cached. |
| F-15 | Keep/dislike feedback: kept papers' DOIs or ids are added to the seeds for the next discovery round ("grow again"). |
| F-20 | Import DOIs from a BibTeX or CSL JSON file to use as discovery seeds. |
| F-40 | Graph view restyled in the ink-on-paper dictionary look, with d3 force layout and an animation-frame draw loop. |
| F-45 | Library node size in the graph proportional to total score, with a legend scale. |
| F-47 | Verdict-first "Why this score" report card: overall grade, one plain sentence, per-component grades and collapsed evidence. |
| F-49 | Pass-rule controls (top X% of the library, minimum score) deciding which papers pass, plus fixes to threshold and subtopic labels. |
| F-50 | Remove the automatic mock fallback: failed requests show an error with Retry; mock data only behind a dev flag. |
| F-51 | Research-question box in the Library panel; the typed question is saved as the first paragraph of the question note. |
| F-60 | Result list as score tiles (ring, mini radar, chips, hover card) plus a compact table with sparkbars, toggleable. |
| F-61 | Library History list: every build is saved and can be reopened, renamed, deleted or exported. |
| F-62 | Research question as a folder with its own seeds, notes and libraries; question switcher and seed upload/paste. |
| F-63 | In-app back/forward navigation history, Back buttons in graph and paper view, and keyboard back/forward shortcuts. |
| F-64 | Inline note title that renames the note (and the question folder), updating tree, tabs and `[[links]]`. |
| J-2 | Review fix: each top result shows a plain "why relevant" sentence with a verified quote; the LLM read covers every returned paper. |
| J-3 | Review fix: "Recent (≤ 3 years)" filter so newly published work is visible near the top. |
| J-4 | Review fix: Tavily contribution made visible, with a Tavily row in the sources panel even before any calls. |
| J-5 | Review fixes: readable seed titles instead of K-ids, short "Author Year" graph labels, field-label cleanup, Scholar chip removed. |
| Q-1 | QA fix: reloading restores the last library of the question and its pass rule, weights, filters and top-N. |
| Q-2 | QA fix: chat scrolls to keep the newest turn, including a proposal card with its Apply button, in view. |
| Q-3 | QA fix: chat recognises "recent" and "clinical" style requests (year and kind filters) and normalises weights consistently. |
| Q-3b | QA fix: the "Applied from chat" banner shows a clean summary built from the proposal, not the model's raw reasoning. |
| Q-3c | QA fix: raw weight numbers in chat text are rewritten as the normalised percentage shares shown in the UI. |
| Q-4 | QA fix: results header counts each paper once (found = scored + excluded) and "Show all N passed" raises the visible count. |
| Q-5 | QA fix: scores near the minimum display enough decimals that the shown value never contradicts a "below minimum" flag. |
| Q-7 | QA fix: larger, clearer rank-move arrows (green up, red down) on results. |
| Q-8 | QA fix: rank-move arrows appear after any re-score (weights, pass rule, filters, chat Apply), not only some of them. |
| Q-10 | QA fix: saved library notes show the normalised weight shares the UI shows, not raw weight values. |
| Q-11 | QA fix: graph legend no longer overlaps controls, and node labels stay inside the canvas instead of being clipped. |
| Q-13 | QA fix: paper relations show names (library title, note or seed name) instead of raw OpenAlex ids. |
| Q-14 | QA fix: navigation shortcuts never fire while typing in inputs or the editor, and need a modifier key. |
| Q2-1 | Missing OpenAlex data is "not assessed" (weight redistributed) rather than scored as zero citations or a 100th percentile. |
| Q2-2 | Weights, pass rule, topK and filters are stored per library, so one question's chat filters do not leak into another. |
| Q2-4 | BibTeX, CSL JSON and Markdown exports are scoped to the active question and also saved into its `exports` folder. |
| Q2-5 | "Add to vault" writes the literature note into the question's `notes` folder on disk instead of a browser-only folder. |
| Q2-6 | Seed resolution falls back to Crossref, PubMed and Europe PMC on OpenAlex rate limits, and reports the source and a notice. |
| Q2-7 | Paper file requests accept both file ids and paper ids (`pmid:...`, DOIs with slashes) instead of returning 400. |
| Q2-8 | PubMed-style author names ("Yan M", "Smith JA") parse to the surname first instead of showing "M et al.". |
| Q2-9 | A paper is labelled editorial only when OpenAlex or PubMed explicitly types it as editorial or comment. |
| Q2-10 | Kind questions in chat ("Which papers are reviews?") are answered completely from the paper labels. |
| Q2-11 | Selecting another question opens that question's last library (or its empty state) instead of keeping the previous one. |
| Q2-12 | The Files "⋯" menu closes on Escape, on outside click, and after an item is chosen. |
| Q2-13 | Results header and status bar show the same counts (found = scored + excluded). |
| Q2-14 | Graph legend no longer overlaps nodes; the layout keeps nodes in the free area above it. |
| Q2-15 | A stray click on "New note" no longer leaves an empty `notes/Untitled.md`; the file is written on the first edit. |
| R-3 | Requirements from the no-mock change: no silent mock fallback (R-3.1) and a visible question box saved to the question note (R-3.2). |
| V-1 | Score donut: each coloured slice is one component's contribution (weight share times value), grey arc is points missed. |
| V-2 | Value bars beside the donut: one bar per component, length is value 0-1, with value and share label; dashed when not assessed. |
| V-3 | Small score donut in the tile hover popover, using the same component colours. |
| V-4 | Mini stacked bar of component contributions on every tile and table row. |

## Consequences

- Code keeps its `D-xx` and task-id comments, so they need no churn. This file resolves them.
- If behaviour changes, write a new ADR that supersedes the row and say so in the PR. Do not edit the row.
