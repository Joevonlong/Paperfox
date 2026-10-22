# Adding a search source

This is the recipe for adding a new Library-mode search source, for example a preprint server or a subject
database. You do not need an API key or an issue first. A maintainer decides whether the new source is enabled by
default (see [step 2](#2-register-it)). Background: [architecture.md § Search sources](architecture.md#search-sources).

## 1. Write the client

Create `server/library/sources/<name>.ts`. Use `arxiv.ts` (keyless, XML) or `scholar.ts` (keyed, JSON) as a template.

- Export a pure parser, for example `parse<Name>(body): Item[]`, and a search function that returns the items and the request URL.
- Do all HTTP through `cachedGet` or `cachedJson` from `server/data/http.ts`. This gives you the raw cache, retry
  and tracing. If the API has a rate limit, add a gate for it in `server/data/http.ts`.
- Keep keys out of URLs. `cachedGet` removes only the `api_key`, `mailto` and `email` query parameters before a URL
  becomes a cache key or goes into a trace (`PRIVATE_PARAMS` in `server/data/http.ts`); everything else in the URL is
  stored and logged as is. So a key must go either in a query parameter named `api_key` or in a request header.
  `cachedGet` does not send custom headers, so a header-keyed source calls `fetch` itself, as
  `server/sources/tavily.ts` does, and must not log or trace the header.
- Map each item to the identifiers you can find (DOI, PMID, PMCID, arXiv id) plus title, year and authors.

## 2. Register it

- Add the name to the `SourceName` enum in `shared/library.ts`. This is an additive contract change: mention it in the PR.
- Add a runner in `gather()` in `server/library/sources/index.ts`, and add it to
  `const runners: Record<SourceName, …> = { … }`. Inside the runner, use `call(source, query, fn)` and
  `add(newCand({ ids, title, year, authors, hits: [hit(…)] }))`, like the existing runners.
- Add a display name to `SOURCE_LABEL` in `client/src/stores/library.ts`. `pnpm typecheck` fails until you do.

### On or off by default

- **UI:** adding the name to `SourceName` makes the source a chip in the Library panel, **switched on** for every
  build started from the UI. `UI_SOURCES` in `client/src/stores/library.ts` is "every `SourceName` except
  `scholar`". To keep the new source out of the UI, so that only API callers can use it (as with Google Scholar),
  add it to the exclusion in `UI_SOURCES`.
- **Server:** do not add the name to the `sources` default of `LibraryRequest` in `shared/library.ts`. That list is
  used only by API requests that send no `sources`, and changing a default is a contract change
  ([AGENTS.md § Contracts](../AGENTS.md#contracts)). A maintainer adds it later if the source should run for those
  callers too.

Say in the PR which UI default you chose. The maintainer decides in review.

## 3. Behave without a key

If the source needs a key, skip it when the key is missing, the way `hasSerpApiKey()` does for Scholar. Report the
skip and return:

```ts
if (!hasMyKey()) { onCall({ source: 'mysource', query: '(all)', count: 0, ms: 0, error: 'skipped — no MYSOURCE_API_KEY' }); return }
```

A missing key or a failing API must never fail the build.

## 4. Test offline

Add a parser test to `server/library/sources/sources.test.ts` that runs on a recorded response stored in the test.
See the `ATOM` constant used by the arXiv tests. Tests must not touch the network.

## 5. Document it

- If the source has a key or other setting, add it to `.env.example` as an optional variable, commented as optional.
- Add a line to [third-party.md](third-party.md) with the data source's terms of use and what PaperTrail stores from it.
- Add the source to the list under **Search** in [features/library-build.md](features/library-build.md): results
  per query, rate limits, and the key it is skipped without.
- Do not edit the source table in the README. A maintainer updates it when they cut the release that ships the
  source.

## 6. Open the PR

Run `pnpm gate` (typecheck, tests, build). A maintainer runs the ranking evaluation for PRs that change search or
ranking. You do not need any keys, and you should not run `eval/library_eval.ts` yourself.
