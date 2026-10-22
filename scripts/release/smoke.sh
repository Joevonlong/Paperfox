#!/usr/bin/env bash
# Smoke-test a PaperTrail container image before it is published.
#
# Usage:
#   scripts/release/smoke.sh <image-ref> [--version X.Y.Z] [--previous <image-ref>]
#
#   <image-ref>   image to test, e.g. ghcr.io/owner/papertrail@sha256:... or papertrail:local
#   --version     version /api/health must report (default: "version" in package.json)
#   --previous    an older release image; adds the upgrade check (data written by the
#                 previous image must be readable by <image-ref>)
#
# Checks (each prints one PASS or FAIL line):
#   start          the container starts and /api/health answers
#   health.ok      /api/health returns ok: true
#   health.version /api/health reports the expected version
#   license        /app/LICENSE exists in the image
#   persist.*      with a volume at /data: create a question and write a note through the
#                  API, replace the container, read the note back unchanged
#   demo-only.*    with PAPERTRAIL_DEMO_ONLY=1: /api/health reports demoOnly: true,
#                  /api/health, /api/demo/* and the client stay reachable, every live
#                  endpoint returns 403
#   upgrade.*      (--previous only) the same round trip, written by the previous image
#                  and read by <image-ref>
#
# The containers get no API keys, and requests that reach a live endpoint by mistake carry
# invalid bodies, so the test never calls an external service.
# Needs docker and curl. Containers and volumes are removed on exit.
# Exit status: 0 = every check passed, 1 = at least one FAIL, 2 = usage error.
set -euo pipefail

usage() {
  echo "usage: $0 <image-ref> [--version X.Y.Z] [--previous <image-ref>]" >&2
  exit 2
}

[[ $# -ge 1 && "$1" != -* ]] || usage
image="$1"
shift
version=''
previous=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) version="${2:-}"; [[ -n "$version" ]] || usage; shift 2 ;;
    --previous) previous="${2:-}"; [[ -n "$previous" ]] || usage; shift 2 ;;
    *) usage ;;
  esac
done
if [[ -z "$version" ]]; then
  pkg="$(git rev-parse --show-toplevel 2> /dev/null)/package.json"
  version="$(sed -nE 's/^[[:space:]]*"version":[[:space:]]*"([^"]+)".*/\1/p' "$pkg" | head -n 1)"
  [[ -n "$version" ]] || { echo "error: --version not given and no version in $pkg" >&2; exit 2; }
fi
version="${version#v}"

readonly WAIT_SECONDS=60
# Every curl call is bounded, so a container that accepts connections but never answers
# cannot hang the script past WAIT_SECONDS or a check.
readonly CURL_TIMEOUTS=(--connect-timeout 5 --max-time 20)
run_id="pt-smoke-$$-$RANDOM"
passed=0
failed=0

# Containers and volumes are found by name: start() and new_volume() run in subshells.
cleanup() {
  local id
  for id in $(docker ps -aq --filter "name=$run_id-"); do docker rm -f "$id" > /dev/null 2>&1 || true; done
  for id in $(docker volume ls -q --filter "name=$run_id-"); do docker volume rm -f "$id" > /dev/null 2>&1 || true; done
}
trap cleanup EXIT

pass() {
  echo "PASS $1${2:+: $2}"
  passed=$((passed + 1))
}
fail() {
  echo "FAIL $1${2:+: $2}"
  failed=$((failed + 1))
}

new_volume() {
  local v="$run_id-$1"
  docker volume create "$v" > /dev/null
  echo "$v"
}

# start <name> <image> [docker run args...] -> prints the base URL, or fails.
start() {
  local name="$run_id-$1" img="$2" port deadline
  shift 2
  docker run -d --name "$name" -p 127.0.0.1::3000 "$@" "$img" > /dev/null
  port="$(docker port "$name" 3000/tcp | head -n 1 | sed 's/.*://')"
  deadline=$((SECONDS + WAIT_SECONDS))
  while ((SECONDS < deadline)); do
    if curl -fsS --connect-timeout 2 --max-time 5 -o /dev/null "http://127.0.0.1:$port/api/health" 2> /dev/null; then
      echo "http://127.0.0.1:$port"
      return 0
    fi
    if [[ "$(docker inspect -f '{{.State.Running}}' "$name" 2> /dev/null)" != true ]]; then
      break
    fi
    sleep 1
  done
  echo "--- logs of $name" >&2
  docker logs "$name" 2>&1 | tail -n 40 >&2
  return 1
}

stop() {
  docker rm -f "$run_id-$1" > /dev/null 2>&1 || true
}

# http <method> <url> [json-body] -> sets $status and $body.
http() {
  local out args=(-sS "${CURL_TIMEOUTS[@]}" -X "$1" -H 'content-type: application/json' -w '\n%{http_code}')
  [[ -z "${3:-}" ]] || args+=(--data "$3")
  out="$(curl "${args[@]}" "$2" 2>&1)" || true
  status="${out##*$'\n'}"
  body="${out%$'\n'*}"
}

json_has() { # json_has <json> <"key":value> (whitespace-insensitive)
  tr -d ' \n\t' <<< "$1" | grep -qF "$2"
}

# write_note <base-url> <question> <marker>: create a question and one note holding <marker>.
write_note() {
  local base="$1" q="$2" marker="$3"
  http POST "$base/api/questions" "{\"id\":\"$q\",\"content\":\"# Question\\n\\nSmoke test $marker\\n\"}"
  [[ "$status" == 200 ]] || { echo "POST /api/questions -> $status ${body:0:200}"; return 1; }
  http PUT "$base/api/questions/$q/notes/notes/smoke.md" "{\"content\":\"# Smoke\\n\\n$marker\\n\"}"
  [[ "$status" == 200 ]] || { echo "PUT note -> $status ${body:0:200}"; return 1; }
}

# read_note <base-url> <question> <marker>: the note written by write_note is there.
read_note() {
  local base="$1" q="$2" marker="$3"
  http GET "$base/api/questions/$q/notes"
  [[ "$status" == 200 ]] || { echo "GET notes -> $status ${body:0:200}"; return 1; }
  grep -qF "$marker" <<< "$body" || { echo "note content not found after the container was replaced"; return 1; }
}

# round_trip <check> <writer-image> <reader-image>
round_trip() {
  local check="$1" writer="$2" reader="$3" vol base q marker msg
  vol="$(new_volume "$check")"
  q="smoke-$RANDOM$RANDOM"
  marker="papertrail-smoke-$run_id-$check"
  if ! base="$(start "$check-1" "$writer" -v "$vol:/data")"; then
    fail "$check.write" "container did not start ($writer)"
    return
  fi
  if msg="$(write_note "$base" "$q" "$marker")"; then
    pass "$check.write" "question and note created"
  else
    fail "$check.write" "$msg"
    stop "$check-1"
    return
  fi
  stop "$check-1"
  if ! base="$(start "$check-2" "$reader" -v "$vol:/data")"; then
    fail "$check.read" "replacement container did not start ($reader)"
    return
  fi
  if msg="$(read_note "$base" "$q" "$marker")"; then
    pass "$check.read" "note read back from the /data volume"
  else
    fail "$check.read" "$msg"
  fi
  stop "$check-2"
}

echo "smoke: $image (expect version $version)"

# --- start, health, license ---------------------------------------------------
if base="$(start main "$image")"; then
  pass start "$base"
  http GET "$base/api/health"
  if json_has "$body" '"ok":true'; then pass health.ok; else fail health.ok "${body:0:200}"; fi
  if json_has "$body" "\"version\":\"$version\""; then
    pass health.version "$version"
  else
    fail health.version "expected $version, got $(tr -d ' \n' <<< "$body" | grep -oE '"version":"[^"]*"' || echo 'no version')"
  fi
  if docker exec "$run_id-main" test -s /app/LICENSE; then
    pass license /app/LICENSE
  else
    fail license '/app/LICENSE is missing or empty'
  fi
  stop main
else
  fail start "container did not answer /api/health within ${WAIT_SECONDS}s"
fi

# --- persistence ---------------------------------------------------------------
round_trip persist "$image" "$image"

# --- demo-only mode --------------------------------------------------------------
if base="$(start demo "$image" -e PAPERTRAIL_DEMO_ONLY=1)"; then
  http GET "$base/api/health"
  if json_has "$body" '"demoOnly":true'; then pass demo-only.health; else fail demo-only.health "no demoOnly: true in /api/health"; fi
  http GET "$base/api/demo/snapshot"
  if [[ "$status" == 200 ]]; then pass demo-only.demo-api "GET /api/demo/snapshot 200"; else fail demo-only.demo-api "GET /api/demo/snapshot -> $status"; fi
  http GET "$base/"
  if [[ "$status" == 200 ]]; then pass demo-only.client "GET / 200"; else fail demo-only.client "GET / -> $status"; fi
  # Live endpoints. Bodies are invalid on purpose: if the guard is missing they fail
  # validation instead of starting real work.
  for probe in 'POST /api/library {}' 'POST /api/runs {}' 'POST /api/seeds/resolve {}' \
    'GET /api/libraries' 'GET /api/questions' 'POST /api/questions {}' 'POST /api/seeds/import'; do
    read -r method path payload <<< "$probe"
    http "$method" "$base$path" "$payload"
    if [[ "$status" == 403 ]]; then
      pass demo-only.blocked "$method $path 403"
    else
      fail demo-only.blocked "$method $path -> $status (want 403)"
    fi
  done
  stop demo
else
  fail demo-only.start "container did not start with PAPERTRAIL_DEMO_ONLY=1"
fi

# --- upgrade ----------------------------------------------------------------------
if [[ -n "$previous" ]]; then
  round_trip upgrade "$previous" "$image"
fi

echo "smoke: $passed passed, $failed failed"
((failed == 0))
