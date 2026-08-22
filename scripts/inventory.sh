#!/usr/bin/env bash

set -euo pipefail

LEAN_WASM_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_WASM_PROJECT_ROOT/scripts/env.sh"

if [[ " $* " != *" --json "* ]]; then
	printf 'project_root=%s\n' "$LEAN_WASM_PROJECT_ROOT"
fi
exec node "$LEAN_WASM_PROJECT_ROOT/scripts/toolchain-preflight.mjs" "$@"
