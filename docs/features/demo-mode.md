# Demo mode

`?demo=1` replays a real, recorded run, so the app can be shown without keys or network.
Server: `server/routes/demo.ts`. Recordings: `server/demo/recordings/`.

## Current behaviour

- Library demo: `server/demo/recordings/library-melanoma.json`, a real Library run recorded by `scripts/record-library.ts`.
  - `GET /api/demo/library/stream` replays the `LibraryEvent`s over SSE.
  - `GET /api/demo/library` returns the stored library.
  - `GET /api/demo/library/papers/:paperId` returns one paper.
  - The same three routes are also served under `/api/library/demo-melanoma…`.
- Seed-pipeline demo: `server/demo/recordings/melanoma.json`, served by `GET /api/demo/stream` (SSE) and
  `GET /api/demo/snapshot`.
- `DEMO_REPLAY_MS` and `DEMO_LIBRARY_REPLAY_MS` set the replay length. `DEMO_RECORDING` and
  `DEMO_LIBRARY_RECORDING` point at other recordings.
- In demo mode the vault sends no write requests (`client/src/stores/vault.ts`), so nothing is written to the workspace. A build replays the recording. Chat runs against the recorded library, which still needs a model key.

## Invariants

- Demo mode must work with no keys and no network.
- Recordings are real runs, never hand-edited numbers.

## Non-goals

- A general record/replay framework for arbitrary runs.
