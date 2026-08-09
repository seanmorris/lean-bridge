#!/usr/bin/env bash

set -euo pipefail

LEAN_NATIVE_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_NATIVE_PROJECT_ROOT/scripts/env.sh"

LEAN_NATIVE_COMMIT=f3b06c705e6c85f5314019d5d3baab0fec5b580c
LEAN_NATIVE_SOURCE=${LEAN_NATIVE_SOURCE:-$LEAN_NATIVE_PROJECT_ROOT/.toolchains/lean4-src}
LEAN_NATIVE_HOST_PREFIX=${LEAN_NATIVE_HOST_PREFIX:-$(lean --print-prefix)}
LEAN_NATIVE_CONFIG_SHA=$(
  printf '%s\n' \
    "$LEAN_NATIVE_COMMIT" \
    native-shared-v1 \
    clang \
    position-independent \
    initial-exec-tls \
    multi-thread \
    system-libuv \
    | sha256sum \
    | awk '{print $1}'
)
LEAN_NATIVE_BUILD_ROOT="$LEAN_NATIVE_PROJECT_ROOT/build/lean-native-runtime/$LEAN_NATIVE_COMMIT-$LEAN_NATIVE_CONFIG_SHA"
LEAN_NATIVE_CMAKE_BUILD="$LEAN_NATIVE_BUILD_ROOT/cmake"
LEAN_NATIVE_ARCHIVE="$LEAN_NATIVE_CMAKE_BUILD/runtime/libleanrt_initial-exec.a"
LEAN_NATIVE_INIT_ARCHIVE="$LEAN_NATIVE_CMAKE_BUILD/lib/lean/libInit.a"

if [[ -d "$LEAN_NATIVE_SOURCE/.git" ]]; then
  actual_commit=$(git -C "$LEAN_NATIVE_SOURCE" rev-parse HEAD)
elif [[ -f "$LEAN_NATIVE_SOURCE/.lean-wasm-source-commit" ]]; then
  actual_commit=$(<"$LEAN_NATIVE_SOURCE/.lean-wasm-source-commit")
else
  echo "Missing pinned Lean source identity; run npm run bootstrap or set LEAN_NATIVE_SOURCE." >&2
  exit 1
fi
if [[ "$actual_commit" != "$LEAN_NATIVE_COMMIT" ]]; then
  echo "Lean source commit mismatch: expected $LEAN_NATIVE_COMMIT, got $actual_commit" >&2
  exit 1
fi
if ! command -v clang >/dev/null || ! command -v clang++ >/dev/null; then
  echo "The native shared runtime requires clang and clang++." >&2
  exit 1
fi
if ! pkg-config --atleast-version=1.0.0 libuv; then
  echo "The native shared runtime requires the libuv development package." >&2
  exit 1
fi

cmake \
  -S "$LEAN_NATIVE_SOURCE/src" \
  -B "$LEAN_NATIVE_CMAKE_BUILD" \
  -G "Unix Makefiles" \
  -DCMAKE_C_COMPILER=clang \
  -DCMAKE_CXX_COMPILER=clang++ \
  -DSTAGE=1 \
  -DPREV_STAGE="$LEAN_NATIVE_HOST_PREFIX" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
  -DUSE_GMP=OFF \
  -DUSE_MIMALLOC=OFF \
  -DMULTI_THREAD=ON \
  -DMMAP=ON \
  -DCCACHE=OFF \
  -DUSE_GITHASH=OFF \
  -DINSTALL_CADICAL=OFF \
  -DINSTALL_LEANTAR=OFF \
  -DWFAIL=OFF \
  "-DCMAKE_C_FLAGS=-ffile-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace -fdebug-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace -fmacro-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace" \
  "-DCMAKE_CXX_FLAGS=-ffile-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace -fdebug-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace -fmacro-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace"

cmake --build "$LEAN_NATIVE_CMAKE_BUILD" --target leanrt_initial-exec --parallel "$(nproc)"

make \
  -C "$LEAN_NATIVE_SOURCE/src" \
  -f "$LEAN_NATIVE_CMAKE_BUILD/stdlib.make" \
  Init \
  LAKE_EXTRA_ARGS=Init:static

if [[ ! -f "$LEAN_NATIVE_ARCHIVE" || ! -f "$LEAN_NATIVE_INIT_ARCHIVE" ]]; then
  echo "Lean did not produce the PIC runtime and Init archives." >&2
  exit 1
fi

AUDIT_DIR="$LEAN_NATIVE_BUILD_ROOT/audit"
mkdir -p "$AUDIT_DIR"
llvm-ar t "$LEAN_NATIVE_ARCHIVE" > "$AUDIT_DIR/libleanrt-members.txt"
llvm-nm --defined-only "$LEAN_NATIVE_ARCHIVE" > "$AUDIT_DIR/libleanrt-defined-symbols.txt"
sha256sum "$LEAN_NATIVE_ARCHIVE" "$LEAN_NATIVE_INIT_ARCHIVE" > "$AUDIT_DIR/sha256.txt"
{
  printf 'lean_commit=%s\n' "$LEAN_NATIVE_COMMIT"
  printf 'config_sha256=%s\n' "$LEAN_NATIVE_CONFIG_SHA"
  printf 'clang_version=%s\n' "$(clang --version | head -n 1)"
  printf 'libuv_version=%s\n' "$(pkg-config --modversion libuv)"
  printf 'tls_model=initial-exec\n'
  printf 'position_independent=true\n'
  printf 'multi_thread=true\n'
} > "$AUDIT_DIR/build-facts.txt"

printf 'native_runtime_archive=%s\n' "$LEAN_NATIVE_ARCHIVE"
printf 'lean_init_archive=%s\n' "$LEAN_NATIVE_INIT_ARCHIVE"
printf 'lean_include_dir=%s\n' "$LEAN_NATIVE_HOST_PREFIX/include"
printf 'lean_config_include_dir=%s\n' "$LEAN_NATIVE_CMAKE_BUILD/include"
printf 'build_root=%s\n' "$LEAN_NATIVE_BUILD_ROOT"
