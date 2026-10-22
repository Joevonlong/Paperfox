# Governance

Paperfox lives in a personal GitHub account. [MAINTAINERS.md](MAINTAINERS.md) is the one list of who holds which
role; no other file names people, except `.github/CODEOWNERS`, which must list the same logins (CI checks this).

## Roles

| Role | GitHub permission | Does |
|---|---|---|
| Lead | Repository owner (admin) | Everything a maintainer does; has the final say; manages repository settings, collaborators and release tags |
| Maintainer | Collaborator (write) | Triages issues and discussions, assigns work, reviews and merges PRs, runs evaluations |
| Contributor | None needed | Opens issues, discussions and PRs ([CONTRIBUTING.md](CONTRIBUTING.md)) |

A personal account offers no finer permission levels. A triager role (labels and assignment without write access)
will be added once the project moves to a GitHub organization.

## Decisions

- Day-to-day decisions use lazy consensus: a proposal in an issue, PR or discussion goes ahead if no maintainer
  objects within a reasonable time (at least 3 days for anything hard to undo).
- If maintainers disagree, the lead decides.
- Breaking changes (see [CONTRIBUTING.md § Versioning](CONTRIBUTING.md#versioning)) need an ADR in `docs/adr/`.
- Recusal: maintainers do not decide on matters about themselves, such as a Code of Conduct report about them or
  their own role. Anyone with a conflict of interest says so and steps back.

## Merging

- CI must be green; nobody can bypass the required checks. PRs are squash-merged.
- External PRs need approval from one maintainer. A maintainer's PR needs approval from another maintainer.
- The lead's own PRs may merge on green CI plus an automated (AI) review recorded in the PR description. Only the
  repository owner can bypass the approval rule on a personal account.

## Joining and leaving

- Contributors with a record of good reviews or PRs can be nominated by any maintainer. Lazy consensus among
  maintainers applies; the lead decides.
- Maintainers may step down at any time. The lead may remove a maintainer after six months of inactivity (after
  asking first) or for a Code of Conduct violation.
- Every change to the list is one PR that edits `MAINTAINERS.md` and `.github/CODEOWNERS` together. After it
  merges, the lead updates collaborator access.
