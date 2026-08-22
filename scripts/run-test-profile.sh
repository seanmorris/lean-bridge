#!/usr/bin/env bash

set -euo pipefail

LEAN_WASM_PROFILE_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_WASM_PROFILE_ROOT/scripts/env.sh"

exec node "$LEAN_WASM_PROFILE_ROOT/scripts/run-test-profile.mjs" "$@"
