# Library history

Every finished build is saved with its question, so it can be reopened without rebuilding (D-35).
Server: `server/library/store.ts` and the library routes. UI: `client/src/library/history/HistoryList.vue`.

## Current behaviour

- Library files are stored in `${WORKSPACE_DIR}/<question>/libraries/<libraryId>/`:
  - `goals.json`
  - `library.json` (the request, summary and every scored paper)
  - `graph.json` (citation nodes and edges)
  - `papers/<paperId>.json`
  - `chat.jsonl`, once chat is used
- Builds without a question are stored under `${DATA_DIR}/library/<libraryId>/`. The UI shows them as "Earlier libraries".
- `GET /api/libraries?questionId=` lists saved libraries, newest first. `GET /api/library/:id` reopens one,
  and `GET /api/library/:id/papers/:paperId` returns one paper file.
- `PATCH /api/library/:id` renames a library. `DELETE /api/library/:id` moves its folder to a `.trash/` folder next
  to it. `GET /api/library/:id/export` downloads one JSON file: `{ library, goals, papers }`.
- The UI asks for confirmation inside the app before a delete. Each opened library is its own Back/Forward navigation entry.

## Invariants

- Opening a saved library never calls a search source or a model.
- Nothing is hard-deleted.
- Library ids are validated before any file access.

## Non-goals

- Diffing two libraries or merging them.
- Rebuilding an old library with new code (build again instead).
