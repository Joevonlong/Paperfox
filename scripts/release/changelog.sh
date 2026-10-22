#!/usr/bin/env bash
# Draft a CHANGELOG.md section from the Conventional Commit subjects since the previous release.
#
# Usage:
#   scripts/release/changelog.sh <version> [--since <rev>] [--to <rev>] [--date YYYY-MM-DD]
#
#   <version>   the version being released, e.g. 0.2.0 (no leading "v")
#   --since     list commits after this revision (any commit, branch or tag). Default: the newest
#               vX.Y.Z tag that --to contains. Before the first vX.Y.Z tag, pass the commit the
#               previous version was cut from (for 0.1.0, which has no tag: d7c5dbc).
#   --to        last commit to include (default HEAD)
#   --date      release date in the heading (default today, UTC)
#
# Prints a Keep a Changelog section on stdout. Commits are grouped by type:
#   Breaking     any "<type>!:" subject or a "BREAKING CHANGE:" footer
#   Features     feat
#   Fixes        fix
#   Performance  perf
#   Other        everything else, including subjects that are not Conventional Commits
#                (listed with their full subject)
# Merge commits and "chore(release): ..." commits are skipped.
#
# The output is a draft: edit the wording for users before it goes into CHANGELOG.md.
# Breaking changes also need an "Upgrade notes" subsection (see CONTRIBUTING.md#versioning).
set -euo pipefail

usage() {
  echo "usage: $0 <version> [--since <rev>] [--to <rev>] [--date YYYY-MM-DD]" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
version="$1"
shift
since=''
to='HEAD'
date="$(date -u +%Y-%m-%d)"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --since) since="${2:-}"; [[ -n "$since" ]] || usage; shift 2 ;;
    --to) to="${2:-}"; [[ -n "$to" ]] || usage; shift 2 ;;
    --date) date="${2:-}"; [[ -n "$date" ]] || usage; shift 2 ;;
    *) usage ;;
  esac
done

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "error: version must look like 1.2.3 or 1.2.3-rc.1 (no leading v), got '$version'" >&2
  exit 2
fi
if [[ ! "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "error: --date must be YYYY-MM-DD, got '$date'" >&2
  exit 2
fi
if [[ -z "$since" ]]; then
  since="$(git tag --list 'v*.*.*' --sort=-v:refname --merged "$to" | head -n 1)"
  if [[ -z "$since" ]]; then
    echo "error: no vX.Y.Z tag in the history of '$to'; pass --since <commit> (see the usage above)" >&2
    exit 2
  fi
fi
for rev in "$since" "$to"; do
  if ! git rev-parse --verify --quiet "$rev^{commit}" > /dev/null; then
    echo "error: unknown revision '$rev'" >&2
    exit 2
  fi
done

breaking=() features=() fixes=() perf=() other=()

# One record per commit: short sha, subject, body; records end with a NUL byte.
while IFS=$'\x1f' read -r -d '' sha subject body; do
  sha="${sha#$'\n'}"
  [[ -n "$sha" ]] || continue
  # chore(release): vX.Y.Z bumps are the release itself.
  [[ "$subject" =~ ^chore\(release\)!?: ]] && continue

  type='' scope='' bang='' desc="$subject"
  if [[ "$subject" =~ ^([a-zA-Z]+)(\(([^\)]*)\))?(!)?:[[:space:]]+(.+)$ ]]; then
    type="$(tr '[:upper:]' '[:lower:]' <<< "${BASH_REMATCH[1]}")"
    scope="${BASH_REMATCH[3]}"
    bang="${BASH_REMATCH[4]}"
    desc="${BASH_REMATCH[5]}"
  fi
  entry="- ${scope:+**${scope}:** }${desc} (${sha})"

  if [[ -n "$bang" ]] || grep -qE '^BREAKING[ -]CHANGE:' <<< "$body"; then
    breaking+=("$entry")
    continue
  fi
  case "$type" in
    feat) features+=("$entry") ;;
    fix) fixes+=("$entry") ;;
    perf) perf+=("$entry") ;;
    # Other keeps the full subject so the type (docs, build, ci, ...) stays visible.
    *) other+=("- ${subject} (${sha})") ;;
  esac
done < <(git log --no-merges --reverse --format='%h%x1f%s%x1f%b%x00' "$since..$to")

section() {
  local title="$1"
  shift
  [[ $# -gt 0 ]] || return 0
  printf '\n### %s\n\n' "$title"
  printf '%s\n' "$@"
}

printf '## [%s] - %s\n' "$version" "$date"
total=$((${#breaking[@]} + ${#features[@]} + ${#fixes[@]} + ${#perf[@]} + ${#other[@]}))
if ((total == 0)); then
  printf '\nNo changes since %s.\n' "$since"
  exit 0
fi
section 'Breaking' ${breaking[@]+"${breaking[@]}"}
if ((${#breaking[@]} > 0)); then
  printf '\n#### Upgrade notes\n\n<!-- Required for breaking changes: what users must do when upgrading. -->\n'
fi
section 'Features' ${features[@]+"${features[@]}"}
section 'Fixes' ${fixes[@]+"${fixes[@]}"}
section 'Performance' ${perf[@]+"${perf[@]}"}
section 'Other' ${other[@]+"${other[@]}"}
