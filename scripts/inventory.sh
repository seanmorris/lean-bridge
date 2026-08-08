#!/usr/bin/env bash

set -euo pipefail

LEAN_WASM_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_WASM_PROJECT_ROOT/scripts/env.sh"

printf 'project_root=%s\n' "$LEAN_WASM_PROJECT_ROOT"
printf 'os='; uname -srmo
printf 'cpu_count=%s\n' "$(nproc)"
printf 'memory_kib=%s\n' "$(awk '/MemTotal/{print $2}' /proc/meminfo)"
printf 'lean='; lean --version
printf 'lake='; lake --version
printf 'emcc='; emcc --version | sed -n '1p'
printf 'node='; node --version
printf 'npm='; npm --version
printf 'nix='; nix --version
printf 'clang='; clang --version | sed -n '1p'
printf 'cmake='; cmake --version | sed -n '1p'
printf 'ninja='; ninja --version
printf 'wasm_objdump='; wasm-objdump --version | sed -n '1p'
printf 'wasm_tools='; wasm-tools --version
