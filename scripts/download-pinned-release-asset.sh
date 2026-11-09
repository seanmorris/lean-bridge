#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <kotlin-compiler|wasmtime-c-api> <destination>" >&2
  exit 64
}

[[ $# -eq 2 ]] || usage

asset_name=$1
destination=$2

case "$asset_name" in
  kotlin-compiler)
    primary_url=https://github.com/JetBrains/kotlin/releases/download/v2.2.0/kotlin-compiler-2.2.0.zip
    api_url=https://api.github.com/repos/JetBrains/kotlin/releases/assets/266479493
    expected_sha256=1adb6f1a5845ba0aa5a59e412e44c8e405236b957de1a9683619f1dca3b16932
    ;;
  wasmtime-c-api)
    primary_url=https://github.com/bytecodealliance/wasmtime/releases/download/v42.0.1/wasmtime-v42.0.1-x86_64-linux-c-api.tar.xz
    api_url=https://api.github.com/repos/bytecodealliance/wasmtime/releases/assets/362397783
    expected_sha256=2097a47351918a446b26c7e65f487278f63bc947591b71897db547cd90c05082
    ;;
  *)
    echo "Unknown pinned release asset: $asset_name" >&2
    usage
    ;;
esac

# Tests and incident response can bypass a broken browser route without
# weakening the immutable asset identity or checksum gate.
primary_url=${LEAN_BRIDGE_RELEASE_PRIMARY_URL_OVERRIDE:-$primary_url}
api_url=${LEAN_BRIDGE_RELEASE_API_URL_OVERRIDE:-$api_url}

destination_dir=$(dirname -- "$destination")
mkdir -p -- "$destination_dir"
partial="${destination}.partial.$$"

cleanup() {
  # shellcheck disable=SC2317 # Invoked by the EXIT trap.
  rm -f -- "$partial"
}
trap cleanup EXIT

download_and_verify() {
  local route_name=$1
  local url=$2
  shift 2

  rm -f -- "$partial"
  if ! curl \
    --fail \
    --location \
    --retry 3 \
    --retry-delay 2 \
    --connect-timeout 20 \
    --max-time 300 \
    "$@" \
    --output "$partial" \
    "$url"; then
    echo "$route_name release route failed for $asset_name" >&2
    return 1
  fi

  if ! printf '%s  %s\n' "$expected_sha256" "$partial" | sha256sum --check --status; then
    echo "$route_name release route returned a checksum mismatch for $asset_name" >&2
    return 1
  fi

  mv -f -- "$partial" "$destination"
}

if download_and_verify primary "$primary_url"; then
  exit 0
fi

echo "Primary release route unavailable; trying the pinned GitHub asset API for $asset_name" >&2
if download_and_verify api "$api_url" --header 'Accept: application/octet-stream'; then
  exit 0
fi

echo "Neither pinned release route produced the checksummed $asset_name asset" >&2
exit 1
