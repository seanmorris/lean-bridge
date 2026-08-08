#!/usr/bin/env bash

set -euo pipefail

LEAN_WASM_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_WASM_PROJECT_ROOT/scripts/env.sh"

LEAN_COMMIT=f3b06c705e6c85f5314019d5d3baab0fec5b580c
LIBUV_COMMIT=e9f29cb984231524e3931aa0ae2c5dae1a32884e
LEAN_SOURCE="$LEAN_WASM_PROJECT_ROOT/.toolchains/lean4-src"
LEAN_PATCH="$LEAN_WASM_PROJECT_ROOT/patches/lean4-4.32.2-emscripten-runtime-signatures.patch"

if [[ ! -d "$LEAN_SOURCE/.git" ]]; then
  echo "Missing pinned Lean source checkout; run npm run bootstrap first." >&2
  exit 1
fi

actual_lean_commit=$(git -C "$LEAN_SOURCE" rev-parse HEAD)
if [[ "$actual_lean_commit" != "$LEAN_COMMIT" ]]; then
  echo "Lean source commit mismatch: expected $LEAN_COMMIT, got $actual_lean_commit" >&2
  exit 1
fi

patch_sha=$(sha256sum "$LEAN_PATCH" | awk '{print $1}')
BUILD_ROOT="$LEAN_WASM_PROJECT_ROOT/build/lean-runtime/$LEAN_COMMIT-$patch_sha"
PATCHED_SOURCE="$BUILD_ROOT/source"
CMAKE_BUILD="$BUILD_ROOT/cmake"
PREPARED_STAMP="$PATCHED_SOURCE/.lean-wasm-patched"

if [[ ! -f "$PREPARED_STAMP" ]]; then
  mkdir -p "$PATCHED_SOURCE"
  git -C "$LEAN_SOURCE" archive "$LEAN_COMMIT" | tar -x -C "$PATCHED_SOURCE"
  patch --batch --forward -d "$PATCHED_SOURCE" -p1 < "$LEAN_PATCH"
  printf '%s\n' "$LEAN_COMMIT $patch_sha" > "$PREPARED_STAMP"
fi

expected_stamp="$LEAN_COMMIT $patch_sha"
actual_stamp=$(<"$PREPARED_STAMP")
if [[ "$actual_stamp" != "$expected_stamp" ]]; then
  echo "Patched source identity mismatch: expected '$expected_stamp', got '$actual_stamp'" >&2
  exit 1
fi

HOST_LEAN_PREFIX=$(lean --print-prefix)

emcmake cmake \
  -S "$PATCHED_SOURCE/src" \
  -B "$CMAKE_BUILD" \
  -G "Unix Makefiles" \
  -DSTAGE=1 \
  -DPREV_STAGE="$HOST_LEAN_PREFIX" \
  -DCMAKE_BUILD_TYPE=Release \
  -DUSE_GMP=OFF \
  -DUSE_MIMALLOC=OFF \
  -DMULTI_THREAD=OFF \
  -DMMAP=OFF \
  -DCCACHE=OFF \
  -DUSE_GITHASH=OFF \
  "-DLEANC_INTERNAL_FLAGS=-pthread -fwasm-exceptions -flto -fPIC -ffp-contract=off" \
  -DINSTALL_CADICAL=OFF \
  -DINSTALL_LEANTAR=OFF \
  -DWFAIL=OFF

cmake --build "$CMAKE_BUILD" --target leanrt --parallel "$(nproc)"

LEAN_RUNTIME_ARCHIVE="$CMAKE_BUILD/lib/lean/libleanrt.a"
if [[ ! -f "$LEAN_RUNTIME_ARCHIVE" ]]; then
  echo "Lean runtime archive was not produced: $LEAN_RUNTIME_ARCHIVE" >&2
  exit 1
fi

# Build only Init's target static facet. The generated stdlib makefile exports
# LEAN_CC=emcc; invoking Lake directly would silently produce host objects.
make \
  -C "$PATCHED_SOURCE/src" \
  -f "$CMAKE_BUILD/stdlib.make" \
  Init \
  LAKE_EXTRA_ARGS=Init:static

LEAN_INIT_ARCHIVE="$CMAKE_BUILD/lib/lean/libInit.a"
if [[ ! -f "$LEAN_INIT_ARCHIVE" ]]; then
  echo "Lean Init archive was not produced: $LEAN_INIT_ARCHIVE" >&2
  exit 1
fi

actual_libuv_commit=$(git -C "$CMAKE_BUILD/libuv/src/libuv" rev-parse HEAD)
if [[ "$actual_libuv_commit" != "$LIBUV_COMMIT" ]]; then
  echo "libuv commit mismatch: expected $LIBUV_COMMIT, got $actual_libuv_commit" >&2
  exit 1
fi

AUDIT_DIR="$BUILD_ROOT/audit"
mkdir -p "$AUDIT_DIR"
"$LEAN_WASM_EMSDK/upstream/bin/llvm-ar" t "$LEAN_RUNTIME_ARCHIVE" > "$AUDIT_DIR/libleanrt-members.txt"
"$LEAN_WASM_EMSDK/upstream/bin/llvm-nm" --defined-only "$LEAN_RUNTIME_ARCHIVE" > "$AUDIT_DIR/libleanrt-defined-symbols.txt"
"$LEAN_WASM_EMSDK/upstream/bin/llvm-ar" t "$LEAN_INIT_ARCHIVE" > "$AUDIT_DIR/libInit-members.txt"
"$LEAN_WASM_EMSDK/upstream/bin/llvm-nm" --defined-only "$LEAN_INIT_ARCHIVE" > "$AUDIT_DIR/libInit-defined-symbols.txt"
first_init_member=$(head -n 1 "$AUDIT_DIR/libInit-members.txt")
"$LEAN_WASM_EMSDK/upstream/bin/llvm-ar" p "$LEAN_INIT_ARCHIVE" "$first_init_member" > "$AUDIT_DIR/libInit-first-member.o"
# Init uses LTO, so archive members are LLVM bitcode. Force one representative
# member through the pinned target linker and inspect the resulting object.
emcc \
  -r \
  -flto \
  -pthread \
  -fwasm-exceptions \
  "$AUDIT_DIR/libInit-first-member.o" \
  -o "$AUDIT_DIR/libInit-first-member-linked.o"
if ! file "$AUDIT_DIR/libInit-first-member-linked.o" | grep -q 'WebAssembly'; then
  echo "Lean Init archive cannot produce wasm32 objects" >&2
  exit 1
fi
sha256sum "$LEAN_PATCH" "$LEAN_RUNTIME_ARCHIVE" "$LEAN_INIT_ARCHIVE" > "$AUDIT_DIR/sha256.txt"

printf 'lean_runtime_archive=%s\n' "$LEAN_RUNTIME_ARCHIVE"
printf 'lean_init_archive=%s\n' "$LEAN_INIT_ARCHIVE"
printf 'lean_source_commit=%s\n' "$LEAN_COMMIT"
printf 'lean_patch_sha256=%s\n' "$patch_sha"
printf 'libuv_commit=%s\n' "$actual_libuv_commit"
