#!/usr/bin/env bash

set -euo pipefail

LEAN_BRIDGE_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_BRIDGE_ROOT/scripts/env.sh"

SOURCE_DIR="$LEAN_BRIDGE_ROOT/poc/performance"
BUILD_DIR="$LEAN_BRIDGE_ROOT/build/performance-reference"
ORDERED_DIR="$BUILD_DIR/ordered-search"
INDEX_DIR="$BUILD_DIR/spatial-index"
CONSUMER_DIR="$BUILD_DIR/spatial-consumer"
VERIFY_DIR="$BUILD_DIR/verify"
mkdir -p "$ORDERED_DIR" "$INDEX_DIR" "$CONSUMER_DIR" "$VERIFY_DIR"

lean -R "$SOURCE_DIR" \
  -o "$ORDERED_DIR/OrderedSearch.olean" \
  -c "$ORDERED_DIR/OrderedSearch.c" \
  "$SOURCE_DIR/OrderedSearch.lean"

LEAN_PATH="$ORDERED_DIR${LEAN_PATH:+:$LEAN_PATH}" lean -R "$SOURCE_DIR" \
  -o "$INDEX_DIR/SpatialIndex.olean" \
  -c "$INDEX_DIR/SpatialIndex.c" \
  "$SOURCE_DIR/SpatialIndex.lean"

LEAN_PATH="$ORDERED_DIR:$INDEX_DIR${LEAN_PATH:+:$LEAN_PATH}" lean -R "$SOURCE_DIR" \
  -o "$CONSUMER_DIR/SpatialConsumer.olean" \
  -c "$CONSUMER_DIR/SpatialConsumer.c" \
  "$SOURCE_DIR/SpatialConsumer.lean"

LEAN_PATH="$ORDERED_DIR:$INDEX_DIR:$CONSUMER_DIR${LEAN_PATH:+:$LEAN_PATH}" lean -R "$SOURCE_DIR" \
  -o "$VERIFY_DIR/Verify.olean" \
  "$SOURCE_DIR/Verify.lean"

LEAN_PATH="$ORDERED_DIR:$INDEX_DIR:$CONSUMER_DIR${LEAN_PATH:+:$LEAN_PATH}" lean --run \
  "$SOURCE_DIR/Verify.lean"

rg -q 'lean_bridge_performance_point_lower_bound' "$ORDERED_DIR/OrderedSearch.c"
rg -q 'lean_bridge_performance_index_size' "$INDEX_DIR/SpatialIndex.c"

printf 'Compiled independent performance components in %s\n' "$BUILD_DIR"
