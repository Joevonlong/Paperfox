# Research question folders

Each research question is one folder on disk, and the server is the source of truth for it (D-33, D-37).
Server: `server/library/workspace.ts` and the `/api/questions` routes in `server/routes/library.ts`. UI: the
question switcher (`client/src/library/questions/`) and the file tree.

## Current behaviour

```
${WORKSPACE_DIR}/<question>/
  Question.md                       the question text (first paragraph after the H1)
  seeds/*.md                        one note per seed paper
  notes/*.md                        the user's notes and literature notes
  libraries/<libraryId>/            built libraries (see library-history.md)
  exports/                          BibTeX / CSL JSON / Markdown zip exports
${WORKSPACE_DIR}/.trash/            deleted questions
```

- `WORKSPACE_DIR` defaults to `./workspace`. The folder name is the question id, and it must be a safe file name
  (no separators, no leading dot, at most 60 characters).
- The routes are `GET/POST /api/questions`, `PATCH/DELETE /api/questions/:id`, `GET /api/questions/:id/notes`,
  `PUT/DELETE /api/questions/:id/notes/*` and `PUT /api/questions/:id/exports/:name`.
- Note paths must end in `.md` and stay inside the question folder. Dot segments, `libraries/` and `exports/` are refused.
- The browser keeps a copy of the notes in IndexedDB (`client/src/stores/vault.ts`) as a write-through cache.
  The default vault is empty.
- A library build sends only the active question's notes and seeds.

## Invariants

- Nothing is hard-deleted. Deleting a question moves the folder to `.trash/`, with a numeric suffix on name clashes.
- No request can read or write outside `WORKSPACE_DIR/<question>/`.
- Demo mode never writes to the workspace.

## Non-goals

- Sync between machines or users.
- Nested questions or sharing notes between questions.
