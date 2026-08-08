#!/usr/bin/env bash

set -euo pipefail

LEAN_WASM_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LEAN_WASM_TOOLCHAINS="$LEAN_WASM_PROJECT_ROOT/.toolchains"
LEAN_WASM_DOWNLOADS="$LEAN_WASM_TOOLCHAINS/downloads"

ELAN_VERSION=v4.2.3
ELAN_ARCHIVE=elan-x86_64-unknown-linux-gnu.tar.gz
ELAN_URL="https://github.com/leanprover/elan/releases/download/$ELAN_VERSION/$ELAN_ARCHIVE"
ELAN_SHA256=df0b2b3a439961ffcbb3985214365ffe40f49bc871df04dff268c7d8e21ca8b2
LEAN_TOOLCHAIN=leanprover/lean4:v4.32.2
LEAN_COMMIT=f3b06c705e6c85f5314019d5d3baab0fec5b580c
EMSDK_VERSION=6.0.6
EMSDK_COMMIT=9981799f744be74ac67b1c1813ff172f63be0630
LEAN_SOURCE_URL=https://github.com/leanprover/lean4.git
LEAN_SOURCE_DIR="$LEAN_WASM_TOOLCHAINS/lean4-src"

mkdir -p "$LEAN_WASM_DOWNLOADS" "$LEAN_WASM_TOOLCHAINS/elan-installer"

if [[ ! -f "$LEAN_WASM_DOWNLOADS/$ELAN_ARCHIVE" ]]; then
  curl --fail --location --silent --show-error "$ELAN_URL" -o "$LEAN_WASM_DOWNLOADS/$ELAN_ARCHIVE"
fi
printf '%s  %s\n' "$ELAN_SHA256" "$LEAN_WASM_DOWNLOADS/$ELAN_ARCHIVE" | sha256sum -c -

if [[ ! -x "$LEAN_WASM_TOOLCHAINS/elan-installer/elan-init" ]]; then
  tar -xzf "$LEAN_WASM_DOWNLOADS/$ELAN_ARCHIVE" -C "$LEAN_WASM_TOOLCHAINS/elan-installer"
fi

export ELAN_HOME="$LEAN_WASM_TOOLCHAINS/elan"
if [[ ! -x "$ELAN_HOME/bin/elan" ]]; then
  "$LEAN_WASM_TOOLCHAINS/elan-installer/elan-init" -y --no-modify-path --default-toolchain none
fi
"$ELAN_HOME/bin/elan" toolchain install "$LEAN_TOOLCHAIN"
"$ELAN_HOME/bin/elan" default "$LEAN_TOOLCHAIN"

actual_lean_commit=$("$ELAN_HOME/bin/lean" --version | sed -n 's/.*commit \([^,)]*\).*/\1/p')
if [[ "$actual_lean_commit" != "$LEAN_COMMIT" ]]; then
  echo "Lean commit mismatch: expected $LEAN_COMMIT, got $actual_lean_commit" >&2
  exit 1
fi

if [[ ! -d "$LEAN_SOURCE_DIR/.git" ]]; then
  git clone --filter=blob:none --no-checkout "$LEAN_SOURCE_URL" "$LEAN_SOURCE_DIR"
fi
git -C "$LEAN_SOURCE_DIR" fetch --depth 1 origin "$LEAN_COMMIT"
git -C "$LEAN_SOURCE_DIR" checkout --detach "$LEAN_COMMIT"

actual_lean_source_commit=$(git -C "$LEAN_SOURCE_DIR" rev-parse HEAD)
if [[ "$actual_lean_source_commit" != "$LEAN_COMMIT" ]]; then
  echo "Lean source commit mismatch: expected $LEAN_COMMIT, got $actual_lean_source_commit" >&2
  exit 1
fi

if [[ ! -d "$LEAN_WASM_TOOLCHAINS/emsdk/.git" ]]; then
  git clone --branch "$EMSDK_VERSION" --depth 1 https://github.com/emscripten-core/emsdk.git "$LEAN_WASM_TOOLCHAINS/emsdk"
fi

actual_emsdk_commit=$(git -C "$LEAN_WASM_TOOLCHAINS/emsdk" rev-parse HEAD)
if [[ "$actual_emsdk_commit" != "$EMSDK_COMMIT" ]]; then
  echo "emsdk commit mismatch: expected $EMSDK_COMMIT, got $actual_emsdk_commit" >&2
  exit 1
fi

"$LEAN_WASM_TOOLCHAINS/emsdk/emsdk" install "$EMSDK_VERSION"
"$LEAN_WASM_TOOLCHAINS/emsdk/emsdk" activate "$EMSDK_VERSION"

# shellcheck source=env.sh
source "$LEAN_WASM_PROJECT_ROOT/scripts/env.sh"

lean --version
lake --version
emcc --version | sed -n '1,2p'
nix --version || true
