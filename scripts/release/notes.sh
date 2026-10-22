#!/usr/bin/env bash
# Print one version's section of CHANGELOG.md (without its "## [x.y.z]" heading).
#
# Usage:
#   scripts/release/notes.sh <version> [<changelog>]
#
#   <version>    e.g. 0.2.0 (a leading "v" is accepted and ignored)
#   <changelog>  default: CHANGELOG.md at the repository root
#
# The section starts at a "## [<version>]" (or "## <version>") heading and ends at the next
# "## " heading or at the link reference definitions at the end of the file. Lines inside
# fenced code blocks (``` or ~~~) never end the section.
# Exit status: 0 = printed, 1 = section missing or empty, 2 = usage error.
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: $0 <version> [<changelog>]" >&2
  exit 2
fi
version="${1#v}"
file="${2:-$(git rev-parse --show-toplevel)/CHANGELOG.md}"
if [[ ! -f "$file" ]]; then
  echo "error: $file not found" >&2
  exit 1
fi

body="$(
  awk -v v="$version" '
    function is_heading(line) {
      # "## [0.2.0] - 2026-10-30", "## [0.2.0]", "## 0.2.0", "## v0.2.0 ..."
      sub(/^## +/, "", line)
      sub(/^\[/, "", line)
      sub(/^v/, "", line)
      return index(line, v) == 1 && (length(line) == length(v) || substr(line, length(v) + 1, 1) ~ /[] ]/)
    }
    # Fenced code blocks: a "## " or "[x]: " line inside one is content, not structure.
    /^ *(```|~~~)/ { fence = !fence; if (found) print; next }
    !fence && /^## / {
      if (found) exit
      if (is_heading($0)) { found = 1; next }
    }
    found && !fence && /^\[[^]]+\]: / { exit }
    found { print }
  ' "$file" |
    # Trim leading and trailing blank lines.
    awk 'NF { started = 1; for (; blanks > 0; blanks--) print ""; print; next } started { blanks++ }'
)"

if [[ -z "$body" ]]; then
  echo "error: no section for version $version in $file" >&2
  exit 1
fi
printf '%s\n' "$body"
