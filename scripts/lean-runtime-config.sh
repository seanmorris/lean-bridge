#!/usr/bin/env bash

# Shared, content-addressed inputs for Lean runtime profile builds. The caller
# defines LEAN_WASM_PROJECT_ROOT and sources scripts/env.sh first.
LEAN_WASM_LEAN_COMMIT=f3b06c705e6c85f5314019d5d3baab0fec5b580c
LEAN_WASM_LIBUV_COMMIT=e9f29cb984231524e3931aa0ae2c5dae1a32884e
LEAN_WASM_SIGNATURE_PATCH="$LEAN_WASM_PROJECT_ROOT/patches/lean4-4.32.2-emscripten-runtime-signatures.patch"
LEAN_WASM_THREADS_PATCH="$LEAN_WASM_PROJECT_ROOT/patches/lean4-4.32.2-emscripten-conditional-pthreads.patch"
LEAN_WASM_OFFLINE_LIBUV_PATCH="$LEAN_WASM_PROJECT_ROOT/patches/lean4-4.32.2-offline-libuv-source.patch"
LEAN_WASM_LEAN_PATCHES=(
  "$LEAN_WASM_SIGNATURE_PATCH"
  "$LEAN_WASM_THREADS_PATCH"
  "$LEAN_WASM_OFFLINE_LIBUV_PATCH"
)

LEAN_WASM_PATCH_SET_SHA=$(
  sha256sum "${LEAN_WASM_LEAN_PATCHES[@]}" \
    | awk '{print $1}' \
    | sha256sum \
    | awk '{print $1}'
)
LEAN_WASM_RUNTIME_PROFILE=${LEAN_WASM_RUNTIME_PROFILE:-browser}
LEAN_WASM_RUNTIME_VARIANT=${LEAN_WASM_RUNTIME_VARIANT:-}
if [[ -n "$LEAN_WASM_RUNTIME_VARIANT" && ! "$LEAN_WASM_RUNTIME_VARIANT" =~ ^[a-z0-9][a-z0-9.-]*$ ]]; then
  echo "Invalid Lean Wasm runtime variant: $LEAN_WASM_RUNTIME_VARIANT" >&2
  exit 1
fi
LEAN_WASM_ARTIFACT_TARGET=${LEAN_WASM_ARTIFACT_TARGET:-$LEAN_WASM_RUNTIME_PROFILE}
if [[ ! "$LEAN_WASM_ARTIFACT_TARGET" =~ ^[a-z0-9][a-z0-9.-]*$ ]]; then
  echo "Invalid Lean Wasm artifact target: $LEAN_WASM_ARTIFACT_TARGET" >&2
  exit 1
fi
LEAN_WASM_RUNTIME_VARIANT_SUFFIX=${LEAN_WASM_RUNTIME_VARIANT:+-$LEAN_WASM_RUNTIME_VARIANT}
LEAN_WASM_PROFILE_CC_FLAGS=(
  -fwasm-exceptions
  -flto
  -fPIC
  -ffp-contract=off
  "-ffile-prefix-map=$LEAN_WASM_PROJECT_ROOT=/workspace"
  "-fdebug-prefix-map=$LEAN_WASM_PROJECT_ROOT=/workspace"
  "-fmacro-prefix-map=$LEAN_WASM_PROJECT_ROOT=/workspace"
)

case "$LEAN_WASM_RUNTIME_PROFILE" in
  browser)
    LEAN_WASM_MULTI_THREAD=OFF
    LEAN_WASM_LINK_SPIKE_DIR="$LEAN_WASM_PROJECT_ROOT/build/lean-link-spike$LEAN_WASM_RUNTIME_VARIANT_SUFFIX"
    ;;
  threaded)
    LEAN_WASM_MULTI_THREAD=ON
    LEAN_WASM_PROFILE_CC_FLAGS+=(-pthread)
    LEAN_WASM_LINK_SPIKE_DIR="$LEAN_WASM_PROJECT_ROOT/build/lean-link-spike-threaded"
    ;;
  *)
    echo "Unsupported Lean Wasm runtime profile: $LEAN_WASM_RUNTIME_PROFILE" >&2
    exit 1
    ;;
esac

LEAN_WASM_RUNTIME_BUILD_ID="$LEAN_WASM_LEAN_COMMIT-$LEAN_WASM_PATCH_SET_SHA-$LEAN_WASM_RUNTIME_PROFILE$LEAN_WASM_RUNTIME_VARIANT_SUFFIX"
