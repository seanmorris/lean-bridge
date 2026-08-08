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

(
  cd "$REPRO_CHECKOUT"
  bash scripts/build-lean-link-spike.sh
)

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

for artifact in "${ARTIFACTS[@]}"; do
  cmp \
    "$LEAN_WASM_PROJECT_ROOT/build/lean-link-spike/$artifact" \
    "$REPRO_CHECKOUT/build/lean-link-spike/$artifact"
done

printf 'Cross-root browser artifacts are byte-identical (%s files).\n' "${#ARTIFACTS[@]}"
