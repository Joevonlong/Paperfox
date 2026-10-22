# Library chat

A chat column about the current library. It answers from the library's own data and can **propose** changes to
ranking settings (D-26, D-29). Server: `server/library/chat.ts`. Client: `client/src/chat/`, `client/src/stores/chat.ts`.

## Current behaviour

- `POST /api/library/:id/chat` takes the message history and the current settings (weights, pass rule, filters).
  The planner model answers from the library JSON (goals and every scored paper), cites papers by rank and title,
  and may return a `proposal` for new weights, a new pass rule or new filters.
- The client shows the proposal as a diff card. Nothing changes until the user clicks Apply. Apply re-scores in the
  browser, shows rank moves, and calls `POST /api/library/:id/applied`. The applied change (prompt, diff, top 10
  before and after) is logged to `${LOG_DIR}/runs/<libraryId>/chat.jsonl` and to `chat.jsonl` in the library folder.
- Questions about paper kinds ("Which papers are reviews?") are answered from the labels in full. They still work
  without a model.
- Without `TOKEN_FACTORY_API_KEY`, other questions get a clear "could not answer" reply, and nothing changes.
- The browser keeps the history per library in `localStorage` (best effort).

## Invariants

- The server never applies a proposal.
- Proposals are sanitised against the current settings before they reach the client.

## Non-goals

- Chat that searches for new papers or rebuilds the library.
