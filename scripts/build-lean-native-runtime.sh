#!/usr/bin/env bash

set -euo pipefail

LEAN_NATIVE_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_NATIVE_PROJECT_ROOT/scripts/env.sh"

LEAN_NATIVE_COMMIT=f3b06c705e6c85f5314019d5d3baab0fec5b580c
LEAN_NATIVE_SOURCE_INPUT=${LEAN_NATIVE_SOURCE:-$LEAN_NATIVE_PROJECT_ROOT/.toolchains/lean4-src}
LEAN_NATIVE_HOST_PREFIX=${LEAN_NATIVE_HOST_PREFIX:-$(lean --print-prefix)}
LEAN_NATIVE_CONFIG_SHA=$(
  printf '%s\n' \
    "$LEAN_NATIVE_COMMIT" \
    native-shared-v2 \
    clang \
    position-independent \
    initial-exec-tls \
    multi-thread \
    system-libuv \
    reproducible-prefix-map \
    | sha256sum \
    | awk '{print $1}'
)
LEAN_NATIVE_BUILD_ROOT="$LEAN_NATIVE_PROJECT_ROOT/build/lean-native-runtime/$LEAN_NATIVE_COMMIT-$LEAN_NATIVE_CONFIG_SHA"
LEAN_NATIVE_SOURCE="$LEAN_NATIVE_BUILD_ROOT/source"
LEAN_NATIVE_CMAKE_BUILD="$LEAN_NATIVE_BUILD_ROOT/cmake"
LEAN_NATIVE_ARCHIVE="$LEAN_NATIVE_CMAKE_BUILD/runtime/libleanrt_initial-exec.a"
LEAN_NATIVE_INIT_ARCHIVE="$LEAN_NATIVE_CMAKE_BUILD/lib/lean/libInit.a"

if [[ -d "$LEAN_NATIVE_SOURCE_INPUT/.git" ]]; then
  actual_commit=$(git -C "$LEAN_NATIVE_SOURCE_INPUT" rev-parse HEAD)
elif [[ -f "$LEAN_NATIVE_SOURCE_INPUT/.lean-wasm-source-commit" ]]; then
  actual_commit=$(<"$LEAN_NATIVE_SOURCE_INPUT/.lean-wasm-source-commit")
else
  echo "Missing pinned Lean source identity; run npm run bootstrap or set LEAN_NATIVE_SOURCE." >&2
  exit 1
fi
if [[ "$actual_commit" != "$LEAN_NATIVE_COMMIT" ]]; then
  echo "Lean source commit mismatch: expected $LEAN_NATIVE_COMMIT, got $actual_commit" >&2
  exit 1
fi

LEAN_NATIVE_LOCK_DIR="$LEAN_NATIVE_BUILD_ROOT/.build-lock"
mkdir -p "$LEAN_NATIVE_BUILD_ROOT"
while ! mkdir "$LEAN_NATIVE_LOCK_DIR" 2>/dev/null; do
  lock_owner=""
  if [[ -f "$LEAN_NATIVE_LOCK_DIR/owner" ]]; then
    lock_owner=$(<"$LEAN_NATIVE_LOCK_DIR/owner")
  fi
  if [[ ! "$lock_owner" =~ ^[0-9]+$ ]] || ! kill -0 "$lock_owner" 2>/dev/null; then
    find "$LEAN_NATIVE_LOCK_DIR" -mindepth 1 -maxdepth 1 -type f -delete 2>/dev/null || true
    rmdir "$LEAN_NATIVE_LOCK_DIR" 2>/dev/null || true
    continue
  fi
  sleep 0.1
done
printf '%s\n' "$$" > "$LEAN_NATIVE_LOCK_DIR/owner"
release_native_build_lock() {
  find "$LEAN_NATIVE_LOCK_DIR" -mindepth 1 -maxdepth 1 -type f -delete 2>/dev/null || true
  rmdir "$LEAN_NATIVE_LOCK_DIR" 2>/dev/null || true
}
trap release_native_build_lock EXIT

if [[ ! -f "$LEAN_NATIVE_SOURCE/src/CMakeLists.txt" ]]; then
  source_stage="$LEAN_NATIVE_BUILD_ROOT/source-stage-$$"
  mkdir -p "$source_stage"
  tar -C "$LEAN_NATIVE_SOURCE_INPUT" --exclude=.git -cf - . | tar -xf - -C "$source_stage"
  chmod -R u+w "$source_stage"
  mv "$source_stage" "$LEAN_NATIVE_SOURCE"
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
  "-DCMAKE_C_FLAGS=-ffile-prefix-map=$LEAN_NATIVE_SOURCE=/workspace/lean4 -fdebug-prefix-map=$LEAN_NATIVE_SOURCE=/workspace/lean4 -fmacro-prefix-map=$LEAN_NATIVE_SOURCE=/workspace/lean4 -ffile-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace -fdebug-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace -fmacro-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace" \
  "-DCMAKE_CXX_FLAGS=-ffile-prefix-map=$LEAN_NATIVE_SOURCE=/workspace/lean4 -fdebug-prefix-map=$LEAN_NATIVE_SOURCE=/workspace/lean4 -fmacro-prefix-map=$LEAN_NATIVE_SOURCE=/workspace/lean4 -ffile-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace -fdebug-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace -fmacro-prefix-map=$LEAN_NATIVE_PROJECT_ROOT=/workspace"

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
BUILD_FACTS_TEMP="$AUDIT_DIR/build-facts.txt.$$"
{
  printf 'lean_commit=%s\n' "$LEAN_NATIVE_COMMIT"
  printf 'config_sha256=%s\n' "$LEAN_NATIVE_CONFIG_SHA"
  printf 'clang_version=%s\n' "$(clang --version | head -n 1)"
  printf 'libuv_version=%s\n' "$(pkg-config --modversion libuv)"
  printf 'tls_model=initial-exec\n'
  printf 'position_independent=true\n'
  printf 'multi_thread=true\n'
} > "$BUILD_FACTS_TEMP"
mv "$BUILD_FACTS_TEMP" "$AUDIT_DIR/build-facts.txt"

printf 'native_runtime_archive=%s\n' "$LEAN_NATIVE_ARCHIVE"
printf 'lean_init_archive=%s\n' "$LEAN_NATIVE_INIT_ARCHIVE"
printf 'lean_include_dir=%s\n' "$LEAN_NATIVE_HOST_PREFIX/include"
printf 'lean_config_include_dir=%s\n' "$LEAN_NATIVE_CMAKE_BUILD/include"
printf 'build_root=%s\n' "$LEAN_NATIVE_BUILD_ROOT"
