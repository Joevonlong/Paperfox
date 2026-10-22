# Third-party code and data

Paperfox is licensed under GPL-3.0-or-later (see [LICENSE](../LICENSE)). This page lists code taken or adapted from
other projects, and the data sources the app and its recordings use.

## Code derived from Zettlr

Upstream: [Zettlr](https://github.com/Zettlr/Zettlr), Copyright © Hendrik Erz and the Zettlr contributors, licensed
under GPL-3.0. Files that came from Zettlr keep their original header comment (`Maintainer: Hendrik Erz`,
`License: GNU GPL v3`) or a comment naming the upstream file. Keep those headers when you edit these files.

Copied with the Zettlr header (`client/src/editor/zettlr/`):

- `parser/frontmatter-parser.ts`, `parser/highlight-parser.ts`, `parser/zkn-link-parser.ts`, `parser/zkn-tag-parser.ts`
- `renderers/base-renderer.ts`, `renderers/render-blockquotes.ts`, `renderers/render-emphasis.ts`,
  `renderers/render-headings.ts`, `renderers/render-hr.ts`, `renderers/render-tasks.ts`
- `theme/editor.ts`, `theme/syntax.ts`, `theme/themes/berlin.ts`
- `util/custom-tags.ts`, `util/range-in-selection.ts`

Adapted or ported (the header comment names the upstream file):

| File | Upstream |
|---|---|
| `client/src/editor/zettlr/editor.css` | `source/common/modules/markdown-editor/editor.css` |
| `client/src/editor/zettlr/parser/markdown-parser.ts` | `source/common/modules/markdown-editor/parser/markdown-parser.ts` (reduced port) |
| `client/src/editor/zettlr/util/configuration.ts` | `source/common/modules/markdown-editor/util/configuration.ts` (shim) |
| `client/src/editor/zettlr/theme/themes/paperfox.ts` | Zettlr's theme variable scheme (see `berlin.ts`) |
| `client/src/graph/directed-graph.ts` | `source/win-stats/directed-graph.ts` (copied unchanged) |
| `client/src/graph/GraphView.vue` | force layout from `source/win-stats/GraphView.vue` |
| `client/src/styles/chrome.css` | `window-register/assets/{main,geometry}.css` |

Layout and interaction modelled on Zettlr, with code written for Paperfox: `client/src/App.vue` (window chrome),
`client/src/workspace/EditorArea.vue` (document tabs), `client/src/workspace/FileTree.vue` (file manager),
`client/src/workspace/Sidebar.vue` (main sidebar tabs), `client/src/workspace/Icon.vue` (stand-in for the
`cds-icon` set).

If you port more code from Zettlr or another GPL-compatible project, keep its header, name the upstream file in a
comment, and add it to this page.

## Data sources

Paperfox queries these services at runtime. It stores their responses only in the local cache under `DATA_DIR` and
in the user's own library files.

| Source | Used for | Terms |
|---|---|---|
| [OpenAlex](https://openalex.org) | Works, venues, authors, citations, search | Data released under CC0. Set `OPENALEX_MAILTO` or `OPENALEX_API_KEY` for the polite pool. |
| [NCBI E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25497/) (PubMed) | Search, abstracts, publication types, similar articles | NCBI usage guidelines (rate limits; `NCBI_API_KEY` optional). Abstracts may be under the publisher's copyright. |
| [Europe PMC](https://europepmc.org/RestfulWebService) | Abstract, reference and cited-by fallback; seed resolution | Europe PMC terms of use. Abstracts may be under the publisher's copyright. |
| [Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) | Seed resolution and cited-by fallback | Crossref REST API etiquette (`CROSSREF_MAILTO`). Bibliographic metadata is free to reuse. |
| [arXiv API](https://info.arxiv.org/help/api/index.html) | Search and metadata | arXiv API terms of use. Requests are throttled to one at a time. |
| [Tavily](https://tavily.com) | Web search for papers (optional, needs `TAVILY_API_KEY`) | Tavily terms of service. Responses are cached under `DATA_DIR/raw/tavily/`. |
| [SerpAPI](https://serpapi.com) | Google Scholar results (optional, needs `SERPAPI_KEY`) | SerpAPI terms of service. Google Scholar is never scraped directly. |
| [Nebius Token Factory](https://tokenfactory.nebius.com) | Embeddings and LLM calls (optional) | Provider terms. The question, notes, titles and abstracts are sent to the model endpoint. |

## Recorded data in this repository

- `server/demo/fixtures/*.json` contain OpenAlex records (CC0) from a real run of the melanoma example. Tests, the
  dev-only mocks and `LIBRARY_FIXTURE=1` use them.
- `server/demo/recordings/*.json` contain real recorded runs used by demo mode: metadata and abstracts from the
  sources above, plus model output. Abstracts stay under their publishers' copyright and are included only to
  demonstrate the app.
- `eval/out_library/*.json` contain per-run evaluation numbers.
