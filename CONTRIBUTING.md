# Contributing to PaperTrail

Thanks for your interest. You do not need API keys to contribute: the app, the tests and `?demo=1` all run without
them. By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

| You want to | Go to |
|---|---|
| Report a bug | [New issue → Bug report](https://github.com/Joevonlong/PaperTrail/issues/new/choose) |
| Suggest a feature or a bigger change | [Discussions › Ideas](https://github.com/Joevonlong/PaperTrail/discussions/categories/ideas) |
| Ask a question | [Discussions › Q&A](https://github.com/Joevonlong/PaperTrail/discussions/categories/q-a) |
| Report a vulnerability | [Private vulnerability report](https://github.com/Joevonlong/PaperTrail/security/advisories/new), never a public issue (see [SECURITY.md](SECURITY.md)) |
| Fix a bug, improve docs, add a search source | Read on, then open a pull request |

Issues are for bugs and for tasks that maintainers have accepted. There is no feature-request form: ideas start in
Discussions, and a maintainer opens an issue once an idea is accepted.

## Finding something to work on

| What you want to do | How |
|---|---|
| Fix a typo, improve docs, or fix a small bug with a test | Open a PR directly. No issue needed. |
| Add a search source following [docs/adding-a-source.md](docs/adding-a-source.md) | Open a PR directly. No issue needed. A maintainer decides whether it is enabled by default. |
| Work on an issue labelled `status: ready` that nobody is assigned to | Comment on the issue with your approach. A maintainer assigns you (target: within 2 working days). You may open a draft PR before that, but the assignee's PR takes precedence. |
| Propose an idea or a larger feature | Start a thread in [Discussions › Ideas](https://github.com/Joevonlong/PaperTrail/discussions/categories/ideas). Once a maintainer accepts it, they open an issue. |
| Work on an issue already assigned to someone else | Please don't. Pick another issue or ask in the issue whether help is wanted. |

Good starting points: issues labelled
[`good first issue`](https://github.com/Joevonlong/PaperTrail/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22)
or [`help wanted`](https://github.com/Joevonlong/PaperTrail/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22).

Assignment rules:

- You cannot assign yourself; maintainers assign. Anyone can open a pull request at any time.
- An assignment is a placeholder to avoid duplicate work. It is not a permission and not a promise to merge.
- If an assigned issue has no linked PR after 14 days, a maintainer will unassign it with a friendly note. You can
  ask to be assigned again.
- A maintainer turns a PR into a draft and points to Discussions only when it conflicts with an accepted direction.

## Dev setup

[docs/development.md](docs/development.md) is the single setup guide: Node and pnpm versions, `pnpm dev`, Docker,
demo mode, local data folders and what runs without keys. The short version:

```bash
corepack enable pnpm   # Node 25+: run `npm i -g corepack` first
pnpm install
pnpm dev               # http://localhost:5173 (API on :3001); add ?demo=1 for a recorded run
pnpm gate              # typecheck + test + build; run before every PR
```

## Pull requests

- **Title:** [Conventional Commits](https://www.conventionalcommits.org/). The `pr-title` check requires the title
  to match this regex:

  ```text
  ^(feat|fix|perf|refactor|docs|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: .+
  ```

  Examples: `fix(server): handle empty DOI`, `docs: clarify demo mode`. Add `!` before the colon for a breaking
  change (see [Versioning](#versioning)). PRs are squash-merged, so the title becomes the commit message on `main`.
- **Description:** fill in the [PR template](.github/pull_request_template.md): what and why, how you verified it,
  and `Closes #<n>` if there is an issue.
- **Checks:** `pnpm gate` must pass locally. CI runs `gate`, `hygiene` and `pr-title`, and all three must be green
  before anything merges.
- **Tests:** add or update tests for behaviour changes. Tests stay offline and use recorded responses.
- **Docs:** if behaviour changes, update the matching `docs/features/<slug>.md` in the same PR.
- **Contracts:** additive changes to `shared/*.ts` need a note in the PR; breaking ones need an ADR (see
  [AGENTS.md § Contracts](AGENTS.md#contracts)).
- **AI or ranking changes:** say which ranking behaviour you expect to change and why. Maintainers run the
  evaluation (see [docs/development.md § Evaluation](docs/development.md#evaluation)); you do not need keys.
- **Release files:** do not edit `CHANGELOG.md` or `docs/media/`. Maintainers update them when they cut a release.
  If your change alters UI shown in the README, say so in the PR.
- **AI-assisted work:** if AI tools wrote a meaningful part of the change, say so in the PR description. Whoever
  opens the PR is responsible for every line in it and must be able to explain it in review.

## Hygiene

The `hygiene` CI check runs [`scripts/check-hygiene.sh`](scripts/check-hygiene.sh). On a pull request it looks only
at the lines and files the PR adds or changes. It blocks:

| Blocked | Why |
|---|---|
| Absolute local paths: home folders and mounted drives on macOS and Linux | They leak details of someone's machine and never work for anyone else. Use repo-relative paths. |
| Environment files (`.env`, `.env.local`, ...; only `.env.example` is allowed) | They usually contain API keys. |
| SQLite databases (`*.sqlite`, `*.sqlite3`, `*.sqlite-wal`, ...) | Local caches and user data do not belong in git. |
| Files larger than 5 MB | They bloat every clone forever. |
| `pull_request_target` in any workflow except `.github/workflows/label-pr.yml` | That trigger runs with write permissions; only the labeler, which never checks out PR code, may use it. |
| `.github/CODEOWNERS` and `MAINTAINERS.md` listing different GitHub logins | `MAINTAINERS.md` is the one list of maintainers; CODEOWNERS must match it. |
| Changes to `CHANGELOG.md` or `docs/media/` outside a `release/*` branch of this repository | Maintainers write them when they cut a release. |

CI also scans the commits for secrets with gitleaks. Run the same checks locally:

```bash
pnpm hygiene                                                 # whole tree
bash scripts/check-hygiene.sh --range upstream/main...HEAD   # only what your branch adds
```

On a fork, add the main repository as `upstream` once:
`git remote add upstream https://github.com/Joevonlong/PaperTrail.git && git fetch upstream`. Run `git fetch upstream`
again before the check so `upstream/main` is current.

If you committed something by mistake, remove it in a new commit. A leaked key must be revoked, not just deleted.

## Labels

[`.github/labels.yml`](.github/labels.yml) defines every label: one `type:` per issue, a `status:` for where it
stands, and the standard `good first issue`, `help wanted` and `dependencies`. Two labels are added to PRs
automatically from the paths they touch ([`.github/labeler.yml`](.github/labeler.yml)):

- `needs-eval`: the PR touches search, scoring or model code. A maintainer runs the ranking evaluation.
- `contract-change`: the PR touches `shared/`, the container, workflows or `package.json`. Reviewers check
  compatibility (see [Versioning](#versioning)).

The weekly triage workflow adds `stale` to `status: needs-info` items that got no reply (see Response times).

## Response times

These are targets for a small volunteer team, not guarantees.

| What | Target |
|---|---|
| First response to a new issue or PR | within 7 days |
| Approving CI for a first-time contributor, assigning an issue you asked for | within 2 working days of a maintainer seeing it |
| Review of a PR that is ready (green CI, template filled in) | within 14 days |
| Issue or PR labelled `status: needs-info` with no reply | reminder after 30 days, closed 7 days later |

If a PR has had no response for 7 days, mention one of the people in [MAINTAINERS.md](MAINTAINERS.md) in the PR.

## Versioning

PaperTrail uses `0.MINOR.PATCH` until 1.0. A release that includes a `feat` or a breaking change (`!`) bumps MINOR;
a release with only fixes bumps PATCH.

**Breaking** means any of:

- The contents of `DATA_DIR` or `WORKSPACE_DIR` change without an automatic migration.
- An environment variable is renamed or removed.
- The HTTP API in `shared/contracts.ts` changes incompatibly.
- The container's port or volume layout changes.
- The format of vault notes changes.

A breaking PR has `!` in its title (for example `feat(server)!: move notes under DATA_DIR`), needs an ADR, and the
release notes include upgrade notes. **Additive** changes are not breaking: a new enum member, a new optional field,
a new optional environment variable.

1.0 comes when the data migration mechanism is stable and two MINOR releases in a row had no breaking changes.

## License

PaperTrail is licensed under [GPL-3.0-or-later](LICENSE). Contributions are accepted under the same license
(inbound = outbound): by opening a pull request you agree that your contribution is licensed under
GPL-3.0-or-later. There is no CLA and no sign-off requirement. You keep the copyright on your work. Only submit
code you have the right to contribute.

## Porting third-party code

Some client code is derived from [Zettlr](https://github.com/Zettlr/Zettlr) (GPL-3.0). When you edit those files,
keep their original header comment. To bring in code from another project:

1. Make sure its license is compatible with GPL-3.0-or-later (for example MIT, BSD, Apache-2.0, LGPL, GPL).
2. Keep the original copyright and license header, or add a comment naming the upstream project and file.
3. Add the file to [docs/third-party.md](docs/third-party.md).
4. Say in the PR where the code came from.

New npm dependencies are checked for license compatibility by the `dependency-review` CI job.
