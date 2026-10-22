#!/usr/bin/env bash
# Repository hygiene checks for things that should never land in this repo.
#
# Usage:
#   scripts/check-hygiene.sh                     scan every tracked file
#   scripts/check-hygiene.sh --range <git-range> scan only what <git-range> adds,
#                                                e.g. --range origin/main...HEAD
#
# Rules:
#   1. Absolute local paths in file contents: /Users/<name>, /Volumes/<name>,
#      /home/<name>/ (a bare prefix such as "/Users/<name>" in docs is fine).
#   2. Tracked environment files: .env, .env.local, ... (.env.example is allowed).
#   3. SQLite databases: *.sqlite, *.sqlite3, *.sqlite-wal, ...
#   4. Files larger than 5 MB.
#   5. pull_request_target in any workflow except .github/workflows/label-pr.yml.
# Secret scanning is done separately by gitleaks in CI.
#
# --range mode only looks at lines and files the range adds or changes, so
# violations already on the base branch do not fail a pull request. The
# no-argument mode reports everything in the tree, including old violations.
#
# Exit status: 0 = clean, 1 = violations found, 2 = usage or git error.
set -euo pipefail

readonly MAX_BYTES=$((5 * 1024 * 1024))
readonly ALLOWED_PRT_WORKFLOW='.github/workflows/label-pr.yml'
readonly HINT='see CONTRIBUTING.md#hygiene'

# The patterns are written so that this file does not match its own rules.
readonly ABS_PATH_RE='(^|[^[:alnum:]._-])/(Users|Volumes)/[[:alnum:]._-]+|(^|[^[:alnum:]._-])/home/[[:alnum:]._-]+/'
readonly PRT_WORD='pull_request''_target'
# Print paths verbatim (no quoting of non-ASCII names), whatever the user's git config.
readonly GIT_OPTS=(-c core.quotePath=false -c diff.noprefix=false -c diff.mnemonicPrefix=false)

range=''
case "${1:-}" in
  '') ;;
  --range)
    range="${2:-}"
    if [[ -z "$range" || $# -ne 2 ]]; then
      echo "usage: $0 [--range <git-range>]" >&2
      exit 2
    fi
    ;;
  -h | --help)
    awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
    exit 0
    ;;
  *)
    echo "usage: $0 [--range <git-range>]" >&2
    exit 2
    ;;
esac

cd "$(git rev-parse --show-toplevel)"

failures=0
fail() {
  echo "This path/pattern is not allowed in this repo: $1; $HINT" >&2
  failures=$((failures + 1))
}

# Path-based rules (2, 3). Reads paths on stdin.
check_paths() {
  local path base
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    base="${path##*/}"
    if [[ "$base" == .env* && "$base" != '.env.example' ]]; then
      fail "environment file '$path' (only .env.example may be committed)"
    fi
    if [[ "$base" == *.sqlite* ]]; then
      fail "SQLite database '$path'"
    fi
  done
}

# Rule 1 on "file<TAB>line<TAB>text" records read from stdin.
check_lines() {
  local file line text match
  while IFS=$'\t' read -r file line text; do
    match="$(printf '%s\n' "$text" | grep -oE "$ABS_PATH_RE" | head -n 1 | sed -E 's/^[^/]//')" || true
    if [[ -n "$match" ]]; then
      fail "absolute local path '${match}' at $file:$line"
    fi
  done
}

human_size() {
  awk -v b="$1" 'BEGIN { printf "%.1f MB", b / 1048576 }'
}

if [[ -n "$range" ]]; then
  # Tip of the range: the part after ".." or "...", HEAD when empty.
  tip="${range##*..}"
  tip="${tip#.}"
  [[ "$range" == *..* ]] || tip="$range"
  tip="${tip:-HEAD}"
  bad_range() {
    echo "error: cannot resolve git range '$range' (is the base branch fetched?)" >&2
    exit 2
  }
  git rev-parse --verify --quiet "$tip^{commit}" > /dev/null || bad_range

  # Added or changed files (A/C/M/R), as they are at the tip.
  changed="$(git "${GIT_OPTS[@]}" diff --no-ext-diff --name-only --diff-filter=ACMR "$range" 2> /dev/null)" ||
    bad_range

  check_paths <<< "$changed"

  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    size="$(git cat-file -s "$tip:$path" 2> /dev/null || echo 0)"
    if ((size > MAX_BYTES)); then
      fail "file larger than 5 MB '$path' ($(human_size "$size"))"
    fi
  done <<< "$changed"

  # Added lines only: turn the zero-context diff into file<TAB>line<TAB>text.
  check_lines < <(
    git "${GIT_OPTS[@]}" diff --no-ext-diff --no-color --unified=0 --diff-filter=ACMR \
      --src-prefix=a/ --dst-prefix=b/ "$range" |
      awk '
        /^\+\+\+ / { file = substr($0, 7); next }
        /^@@ / {
          split($3, a, ",")
          line = substr(a[1], 2) + 0
          next
        }
        /^\+/ { printf "%s\t%d\t%s\n", file, line, substr($0, 2); line++ }
      '
  )

  workflows="$(git ls-tree -r --name-only "$tip" -- .github/workflows)"
  while IFS= read -r wf; do
    [[ -n "$wf" && "$wf" != "$ALLOWED_PRT_WORKFLOW" ]] || continue
    # Not "grep -q": it exits at the first match, git show then dies of SIGPIPE, and under
    # pipefail the pipeline counts as false, so the violation would be missed.
    if git show "$tip:$wf" | grep "$PRT_WORD" > /dev/null; then
      fail "$PRT_WORD in '$wf' (only $ALLOWED_PRT_WORKFLOW may use it)"
    fi
  done <<< "$workflows"
else
  check_paths < <(git "${GIT_OPTS[@]}" ls-files)

  while IFS= read -r path; do
    [[ -f "$path" ]] || continue
    size="$(wc -c < "$path" | tr -d ' ')"
    if ((size > MAX_BYTES)); then
      fail "file larger than 5 MB '$path' ($(human_size "$size"))"
    fi
  done < <(git "${GIT_OPTS[@]}" ls-files)

  # git grep -n prints file:line:text; turn it into tab-separated records.
  check_lines < <(
    { git "${GIT_OPTS[@]}" grep -nIE "$ABS_PATH_RE" || true; } |
      awk '{
        i = index($0, ":"); rest = substr($0, i + 1); j = index(rest, ":")
        printf "%s\t%s\t%s\n", substr($0, 1, i - 1), substr(rest, 1, j - 1), substr(rest, j + 1)
      }'
  )

  while IFS= read -r wf; do
    [[ -n "$wf" && "$wf" != "$ALLOWED_PRT_WORKFLOW" ]] || continue
    fail "$PRT_WORD in '$wf' (only $ALLOWED_PRT_WORKFLOW may use it)"
  done < <(git "${GIT_OPTS[@]}" grep -l "$PRT_WORD" -- .github/workflows || true)
fi

# --- Rule: CODEOWNERS matches MAINTAINERS.md ---------------------------------
# MAINTAINERS.md is the one list of maintainers; .github/CODEOWNERS must name
# exactly the same GitHub logins (compared case-insensitively). --range mode
# checks this only when the range touches either file; the no-argument mode
# always checks it. Nothing is checked when both files are absent.
check_codeowners() {
  local owners_file='.github/CODEOWNERS' maintainers_file='MAINTAINERS.md'
  local owners_text='' maintainers_text='' has_owners=0 has_maintainers=0
  local owners maintainers only_owners only_maintainers

  if [[ -n "$range" ]]; then
    local touched
    touched="$(git "${GIT_OPTS[@]}" diff --no-ext-diff --name-only "$range" -- "$owners_file" "$maintainers_file")"
    [[ -n "$touched" ]] || return 0
    if owners_text="$(git show "$tip:$owners_file" 2> /dev/null)"; then has_owners=1; fi
    if maintainers_text="$(git show "$tip:$maintainers_file" 2> /dev/null)"; then has_maintainers=1; fi
  else
    if [[ -f "$owners_file" ]]; then owners_text="$(cat "$owners_file")" && has_owners=1; fi
    if [[ -f "$maintainers_file" ]]; then maintainers_text="$(cat "$maintainers_file")" && has_maintainers=1; fi
  fi

  ((has_owners + has_maintainers > 0)) || return 0
  if ((has_owners == 0 || has_maintainers == 0)); then
    fail "only one of $owners_file and $maintainers_file exists (add or remove both)"
    return 0
  fi

  # CODEOWNERS: every @login on non-comment lines (teams such as @org/name are not logins).
  owners="$(printf '%s\n' "$owners_text" | sed -e 's/#.*//' | tr -s '[:blank:]' '\n' |
    grep -E '^@[A-Za-z0-9-]+$' | cut -c2- | tr '[:upper:]' '[:lower:]' | sort -u)" || true
  # MAINTAINERS.md: the @login in the first cell of each table row.
  maintainers="$(printf '%s\n' "$maintainers_text" | awk -F'|' '/^[[:space:]]*\|/ { print $2 }' |
    grep -oE '@[A-Za-z0-9-]+' | cut -c2- | tr '[:upper:]' '[:lower:]' | sort -u)" || true

  if [[ -z "$maintainers" ]]; then
    fail "no @login found in the table in $maintainers_file"
    return 0
  fi
  if [[ "$owners" != "$maintainers" ]]; then
    only_owners="$(comm -23 <(printf '%s\n' "$owners") <(printf '%s\n' "$maintainers") | sed '/^$/d' | paste -sd, -)"
    only_maintainers="$(comm -13 <(printf '%s\n' "$owners") <(printf '%s\n' "$maintainers") | sed '/^$/d' | paste -sd, -)"
    fail "$owners_file and $maintainers_file list different logins (only in CODEOWNERS: ${only_owners:-none}; only in MAINTAINERS.md: ${only_maintainers:-none})"
  fi
}
check_codeowners
# --- End rule: CODEOWNERS matches MAINTAINERS.md ------------------------------

if ((failures > 0)); then
  echo "hygiene: $failures problem(s) found" >&2
  exit 1
fi
if [[ -n "$range" ]]; then
  echo "hygiene: ok ($range)"
else
  echo "hygiene: ok (full tree)"
fi
