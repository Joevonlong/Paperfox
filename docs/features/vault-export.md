# Literature notes and export

Library papers can be saved as literature notes, and a question's references can be exported.
Code: `client/src/library/libraryNote.ts`, `client/src/discover/literatureNote.ts`, `client/src/workspace/export.ts`,
and the References tab in `client/src/workspace/Sidebar.vue`.

## Current behaviour

- "Add to vault" on a library paper writes a Markdown note with front matter to `<question>/notes/`. The note holds
  the ids, authors, year, venue, labels, the total score and its top evidence lines.
- The References tab lists the bibliography of the **active question only**: its seeds, its notes, and older vault
  notes of papers in its loaded library.
- The tab exports BibTeX, CSL JSON, or a Markdown `.zip` of the notes (store-only zip, no dependency). Each export is
  saved to `<question>/exports/` through `PUT /api/questions/:id/exports/:name`.
- BibTeX keeps the first 10 authors and adds "and others" when the list was capped.

## Invariants

- Exports contain only the active question's material.
- The editor is plain Markdown with front matter, and the notes stay readable in any Markdown tool.

## Non-goals

- Citation-style rendering (CSL processors) or word-processor plugins.
