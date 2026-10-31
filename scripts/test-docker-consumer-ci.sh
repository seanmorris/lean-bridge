#!/usr/bin/env bash

# Retries one exact transient Lean core bootstrap failure in the Docker consumer job.

set -euo pipefail

LEAN_BRIDGE_CI_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LEAN_BRIDGE_CI_LOG=$(mktemp "${TMPDIR:-/tmp}/lean-bridge-docker-consumer.XXXXXX")
LEAN_BRIDGE_CI_SOURCE=
# shellcheck disable=SC2016 # Backticks are part of Lean's literal diagnostic.
LEAN_BRIDGE_CI_SIMP_MARKER='`simp` made no progress'

cleanup() {
	rm -f -- "$LEAN_BRIDGE_CI_LOG"
	if [[ -n "$LEAN_BRIDGE_CI_SOURCE" ]]; then
		case "$LEAN_BRIDGE_CI_SOURCE" in
			*/lean-bridge-docker-source.*)
				rm -rf -- "$LEAN_BRIDGE_CI_SOURCE"
				;;
			*)
				echo "Refusing to remove unexpected source snapshot: $LEAN_BRIDGE_CI_SOURCE" >&2
				exit 1
				;;
		esac
	fi
}
trap cleanup EXIT

run_consumer() {
	if [[ -z "${LEAN_BRIDGE_CONSUMER_SOURCE_MODE:-}" ]]; then
		npm run test:consumer:node
		return
	fi
	if [[ "$LEAN_BRIDGE_CONSUMER_SOURCE_MODE" != sparse-path ]]; then
		echo "Unknown consumer source mode: $LEAN_BRIDGE_CONSUMER_SOURCE_MODE" >&2
		return 2
	fi
	local flake="path:$LEAN_BRIDGE_CI_SOURCE"
	nix --extra-experimental-features 'nix-command flakes' build \
		"$flake#universal-core-artifacts" \
		--out-link build/consumer-ci-runtime
	nix --extra-experimental-features 'nix-command flakes' build \
		"$flake#npm-package" \
		--out-link build/consumer-node-alpha-package
	LEAN_BRIDGE_RUNTIME_ROOT=build/consumer-ci-runtime/lazy \
		LEAN_BRIDGE_ALPHA_NPM_PACKAGE_ROOT=build/consumer-node-alpha-package \
		node --test tests/consumer-node.test.mjs
}

case "${LEAN_BRIDGE_CONSUMER_SOURCE_MODE:-}" in
	"")
		;;
	sparse-path)
		LEAN_BRIDGE_CI_SOURCE=$(mktemp -d \
			"${RUNNER_TEMP:-${TMPDIR:-/tmp}}/lean-bridge-docker-source.XXXXXX")
		git -C "$LEAN_BRIDGE_CI_ROOT" archive --format=tar HEAD -- . \
			':(exclude)docs/evidence' \
			| tar -C "$LEAN_BRIDGE_CI_SOURCE" -xf -
		test ! -e "$LEAN_BRIDGE_CI_SOURCE/docs/evidence"
		test -f "$LEAN_BRIDGE_CI_SOURCE/flake.nix"
		test -f "$LEAN_BRIDGE_CI_SOURCE/package.json"
		test -f "$LEAN_BRIDGE_CI_SOURCE/tests/consumer-node.test.mjs"
		;;
	*)
		echo "Unknown consumer source mode: $LEAN_BRIDGE_CONSUMER_SOURCE_MODE" >&2
		exit 2
		;;
esac

for attempt in 1 2; do
	set +e
	(
		cd "$LEAN_BRIDGE_CI_ROOT"
		run_consumer
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
