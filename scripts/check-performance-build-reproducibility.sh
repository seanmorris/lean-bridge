#!/usr/bin/env bash

set -euo pipefail

PERFORMANCE_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PERFORMANCE_OUTPUT="$PERFORMANCE_PROJECT_ROOT/build/performance-reproducibility/build-comparison.json"

while (($# > 0)); do
  case "$1" in
    --output)
      PERFORMANCE_OUTPUT=$(realpath -m "$2")
      shift 2
      ;;
    *)
      printf 'Unknown performance reproducibility option: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

if [[ -n $(git -C "$PERFORMANCE_PROJECT_ROOT" status --porcelain=v1 --untracked-files=all -- .) ]]; then
  printf 'Performance reproducibility requires a clean committed source tree.\n' >&2
  exit 1
fi

PERFORMANCE_REVISION=$(git -C "$PERFORMANCE_PROJECT_ROOT" rev-parse HEAD)
if [[ $(git -C "$PERFORMANCE_PROJECT_ROOT" rev-parse --is-shallow-repository) == true ]]; then
  printf 'Performance reproducibility requires complete committed history to share objects between clean builds.\n' >&2
  exit 1
fi
PERFORMANCE_SCRATCH=$(mktemp -d -t lean-bridge-performance-repro.XXXXXX)

cleanup() {
  rm -rf -- "$PERFORMANCE_SCRATCH"
}
trap cleanup EXIT

report_disk() {
  printf 'Performance reproducibility disk %s:\n' "$1" >&2
  df -h / "$PERFORMANCE_SCRATCH" >&2
}

report_disk "before the clean builds"

for name in a b; do
  checkout="$PERFORMANCE_SCRATCH/source-$name"
  git clone --quiet --shared --no-checkout \
    "$PERFORMANCE_PROJECT_ROOT" "$checkout"
  git -C "$checkout" sparse-checkout set --no-cone '/*' '!/docs/evidence/'
  git -C "$checkout" checkout --quiet --detach "$PERFORMANCE_REVISION"
  ln -s "$PERFORMANCE_PROJECT_ROOT/.toolchains" "$checkout/.toolchains"
  ln -s "$PERFORMANCE_PROJECT_ROOT/node_modules" "$checkout/node_modules"
  (
    cd "$checkout"
    bash scripts/build-performance-wasm.sh
    bash scripts/build-performance-scaling.sh
  )
done

report_disk "after the clean builds"

mkdir -p "$(dirname "$PERFORMANCE_OUTPUT")"
node "$PERFORMANCE_PROJECT_ROOT/scripts/compare-performance-builds.mjs" \
  --build-a "$PERFORMANCE_SCRATCH/source-a" \
  --build-b "$PERFORMANCE_SCRATCH/source-b" \
  --output "$PERFORMANCE_OUTPUT"

printf 'Performance build comparison passed for %s.\n' "$PERFORMANCE_REVISION"
