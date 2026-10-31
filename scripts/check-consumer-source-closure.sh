#!/usr/bin/env bash
# Refuse downstream Nix builds that materialize the retained evidence payloads.

set -euo pipefail

if [[ "$#" -ne 0 ]]; then
	printf 'Usage: %s\n' "$0" >&2
	exit 64
fi

test -d docs/evidence
test -f docs/evidence/vo1220-exact-type-surface-v1.json

unexpected_payload="$(find docs/evidence -mindepth 2 -type f \
	! -name index.json -print -quit)"
if [[ -n "$unexpected_payload" ]]; then
	printf 'Retained evidence payload escaped the sparse checkout: %s\n' \
		"$unexpected_payload" >&2
	exit 1
fi

missing_blobs="$(git rev-list --objects --missing=print HEAD \
	| grep -c '^?' || true)"
git_kib="$(du -sk .git | cut -f1)"
source_kib="$(du -sk --exclude=.git . | cut -f1)"
evidence_kib="$(du -sk docs/evidence | cut -f1)"

test "$missing_blobs" -gt 1000
test "$git_kib" -lt 2097152
test "$source_kib" -lt 2097152
test "$evidence_kib" -lt 1572864

printf 'missing blobs: %s\n.git KiB: %s\nsource KiB: %s\nevidence metadata KiB: %s\n' \
	"$missing_blobs" "$git_kib" "$source_kib" "$evidence_kib"
df -h / "$GITHUB_WORKSPACE"
