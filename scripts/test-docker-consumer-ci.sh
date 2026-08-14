#!/usr/bin/env bash

# Retries one exact transient Lean core bootstrap failure in the Docker consumer job.

set -euo pipefail

LEAN_BRIDGE_CI_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LEAN_BRIDGE_CI_LOG=$(mktemp "${TMPDIR:-/tmp}/lean-bridge-docker-consumer.XXXXXX")
# shellcheck disable=SC2016 # Backticks are part of Lean's literal diagnostic.
LEAN_BRIDGE_CI_SIMP_MARKER='`simp` made no progress'
trap 'rm -f "$LEAN_BRIDGE_CI_LOG"' EXIT

for attempt in 1 2; do
	set +e
	(
		cd "$LEAN_BRIDGE_CI_ROOT"
		npm run test:consumer:node
	) 2>&1 | tee "$LEAN_BRIDGE_CI_LOG"
	status=${PIPESTATUS[0]}
	set -e
	if [[ "$status" -eq 0 ]]; then
		exit 0
	fi
	if [[ "$attempt" -eq 1 ]] \
		&& grep -Fq 'Init/Data/List/MinMaxIdx.lean' "$LEAN_BRIDGE_CI_LOG" \
		&& grep -Fq "$LEAN_BRIDGE_CI_SIMP_MARKER" "$LEAN_BRIDGE_CI_LOG"; then
		echo "Detected the known transient Lean Init bootstrap failure. Retrying the exact pinned derivation once." >&2
		: > "$LEAN_BRIDGE_CI_LOG"
		continue
	fi
	exit "$status"
done
