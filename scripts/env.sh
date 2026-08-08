#!/usr/bin/env bash

set -euo pipefail

LEAN_WASM_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
export LEAN_WASM_PROJECT_ROOT

LEAN_WASM_HOST_LEAN_PREFIX=${LEAN_WASM_HOST_LEAN_PREFIX:-}
if [[ -n "$LEAN_WASM_HOST_LEAN_PREFIX" ]]; then
  export PATH="$LEAN_WASM_HOST_LEAN_PREFIX/bin:$PATH"
else
  export ELAN_HOME="${ELAN_HOME:-$LEAN_WASM_PROJECT_ROOT/.toolchains/elan}"
  export PATH="$ELAN_HOME/bin:$PATH"
fi

LEAN_WASM_EMSDK=${LEAN_WASM_EMSDK:-$LEAN_WASM_PROJECT_ROOT/.toolchains/emsdk}
export LEAN_WASM_EMSDK

if [[ -f "$LEAN_WASM_EMSDK/emsdk_env.sh" ]]; then
  export EMSDK_QUIET=1
  # shellcheck source=/dev/null
  source "$LEAN_WASM_EMSDK/emsdk_env.sh" >/dev/null
fi
