#!/usr/bin/env bash

set -euo pipefail

LEAN_WASM_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
REPRO_WORK_ROOT=$(mktemp -d -t lean-wasm-repro.XXXXXX)
REPRO_CHECKOUT="$REPRO_WORK_ROOT/checkout"

cleanup() {
  rm -rf -- "$REPRO_WORK_ROOT"
}
trap cleanup EXIT

mkdir -p "$REPRO_CHECKOUT"
(
  cd "$LEAN_WASM_PROJECT_ROOT"
  git ls-files -z --cached --others --exclude-standard \
    | tar --null -T - -cf -
) | tar -xf - -C "$REPRO_CHECKOUT"
ln -s "$LEAN_WASM_PROJECT_ROOT/.toolchains" "$REPRO_CHECKOUT/.toolchains"

ARTIFACTS=(
  startup/main.mjs
  startup/main.wasm
  startup/alpha.so.wasm
  startup/beta.so.wasm
  startup/gamma.so.wasm
  lazy/main.mjs
  lazy/main.wasm
  lazy/alpha.so.wasm
  lazy/beta.so.wasm
  lazy/gamma.so.wasm
  final-static/main.mjs
  final-static/main.wasm
  final-static/alpha.generated.o
  final-static/alpha.shim.o
  final-static/beta.generated.o
  final-static/beta.shim.o
  final-static/gamma.generated.o
  final-static/gamma.shim.o
  audit/resolved-side-startup.json
  audit/resolved-side-lazy.json
  audit/resolved-final-static.json
  audit/artifact-manifest.json
  audit/sha256.txt
)

PROFILES=(browser threaded)

for profile in "${PROFILES[@]}"; do
  case "$profile" in
    browser)
      build_directory=lean-link-spike
      ;;
    threaded)
      build_directory=lean-link-spike-threaded
      ;;
  esac

  (
    cd "$REPRO_CHECKOUT"
    LEAN_WASM_RUNTIME_PROFILE="$profile" bash scripts/build-lean-link-spike.sh
  )

  for artifact in "${ARTIFACTS[@]}"; do
    cmp \
      "$LEAN_WASM_PROJECT_ROOT/build/$build_directory/$artifact" \
      "$REPRO_CHECKOUT/build/$build_directory/$artifact"
  done

  printf 'Cross-root %s artifacts are byte-identical (%s files).\n' \
    "$profile" \
    "${#ARTIFACTS[@]}"
done
