#!/usr/bin/env bash

# Retry one command only for Lean's observed transient MinMaxIdx bootstrap failure.

set -euo pipefail

if [[ "$#" -eq 0 ]]; then
	echo "usage: retry-lean-bootstrap-ci.sh COMMAND [ARG ...]" >&2
	exit 2
fi

LEAN_BRIDGE_RETRY_LOG=$(mktemp "${TMPDIR:-/tmp}/lean-bridge-bootstrap-retry.XXXXXX")
# shellcheck disable=SC2016 # Backticks are part of Lean's literal diagnostic.
LEAN_BRIDGE_RETRY_SIMP_MARKER='`simp` made no progress'
trap 'rm -f -- "$LEAN_BRIDGE_RETRY_LOG"' EXIT

for attempt in 1 2; do
	set +e
	"$@" 2>&1 | tee "$LEAN_BRIDGE_RETRY_LOG"
	status=${PIPESTATUS[0]}
	set -e
	if [[ "$status" -eq 0 ]]; then
		exit 0
	fi
	if [[ "$attempt" -eq 1 ]] \
		&& grep -Fq 'Init/Data/List/MinMaxIdx.lean' "$LEAN_BRIDGE_RETRY_LOG" \
		&& grep -Fq "$LEAN_BRIDGE_RETRY_SIMP_MARKER" "$LEAN_BRIDGE_RETRY_LOG"; then
		echo "Detected the known transient Lean Init bootstrap failure. Retrying the exact command once." >&2
		: > "$LEAN_BRIDGE_RETRY_LOG"
		continue
	fi
	exit "$status"
done
