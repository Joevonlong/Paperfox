# Seed import

Seeds are the papers a researcher already trusts for a question. They become `knownPapers` for the library build
(graph expansion and the graph component of the score). Server: `server/library/seed-import.ts`,
`POST /api/seeds/import`, `POST /api/seeds/resolve`. UI: `client/src/library/seeds/SeedPanel.vue`.

## Current behaviour

- Paste ids, or upload a file (D-36). Supported inputs:
  - pasted ids: DOI, PMID, PMCID, arXiv id, OpenAlex `W…` id, or URLs that contain one;
  - `.bib`, `.ris`, CSL JSON (`.json`), `.csv` and `.txt`;
  - `.pdf`: the DOI is taken from the first 2 pages.
- `POST /api/seeds/import` (multipart field `file`) returns `{ ids, format, file }`. The client then resolves the ids
  with `POST /api/seeds/resolve` (at most 50 inputs per call). It tries OpenAlex first. When OpenAlex cannot answer, a DOI falls back to Crossref and then Europe PMC; a PMID to PubMed and then Europe PMC; a PMCID to Europe PMC. The
  panel shows the source of a seed that did not come from OpenAlex (for example "via Crossref").
- Each resolved seed is written as a note under `<question>/seeds/`. The seed table belongs to the current question only.

## Invariants

- A seed belongs to exactly one question. Builds never read another question's seeds.
- Resolution is per input: an id that cannot be resolved is returned in `errors` and does not block the others.

## Non-goals

- Importing full text or annotations.
- Reference-manager sync (Zotero, Mendeley).
