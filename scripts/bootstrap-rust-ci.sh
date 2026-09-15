#!/usr/bin/env bash
# Install the pinned ordinary Rust acceptance compiler without changing user profiles.
set -euo pipefail
LEAN_BRIDGE_RUST_VERSION=1.90.0
LEAN_BRIDGE_RUST_PREFIX="${LEAN_BRIDGE_RUST_PREFIX:-$(pwd)/.toolchains/rust-1.90.0}"
if test -x "$LEAN_BRIDGE_RUST_PREFIX/bin/rustc"; then
  test "$("$LEAN_BRIDGE_RUST_PREFIX/bin/rustc" --version)" = 'rustc 1.90.0 (1159e78c4 2025-09-14)'
  test -x "$LEAN_BRIDGE_RUST_PREFIX/bin/cargo"
  "$LEAN_BRIDGE_RUST_PREFIX/bin/rustc" --version
  exit 0
fi
LEAN_BRIDGE_RUST_DOWNLOAD=$(mktemp -d)
trap 'rm -rf "$LEAN_BRIDGE_RUST_DOWNLOAD"' EXIT
LEAN_BRIDGE_RUST_ARCHIVE="rust-$LEAN_BRIDGE_RUST_VERSION-x86_64-unknown-linux-gnu"
curl --fail --location --retry 3 \
  "https://static.rust-lang.org/dist/$LEAN_BRIDGE_RUST_ARCHIVE.tar.xz" \
  --output "$LEAN_BRIDGE_RUST_DOWNLOAD/rust.tar.xz"
test "$(sha256sum "$LEAN_BRIDGE_RUST_DOWNLOAD/rust.tar.xz" | cut -d ' ' -f 1)" = bff8974f2d3ee6c0e6ac926b533f65bbdd3697d2c2b925bdae5f45b9eed10a67
tar -xJf "$LEAN_BRIDGE_RUST_DOWNLOAD/rust.tar.xz" -C "$LEAN_BRIDGE_RUST_DOWNLOAD" \
  "$LEAN_BRIDGE_RUST_ARCHIVE/install.sh" "$LEAN_BRIDGE_RUST_ARCHIVE/components" \
  "$LEAN_BRIDGE_RUST_ARCHIVE/rust-installer-version" "$LEAN_BRIDGE_RUST_ARCHIVE/rustc" \
  "$LEAN_BRIDGE_RUST_ARCHIVE/cargo" "$LEAN_BRIDGE_RUST_ARCHIVE/rust-std-x86_64-unknown-linux-gnu"
bash "$LEAN_BRIDGE_RUST_DOWNLOAD/$LEAN_BRIDGE_RUST_ARCHIVE/install.sh" \
  --prefix="$LEAN_BRIDGE_RUST_PREFIX" --disable-ldconfig \
  --components=rustc,cargo,rust-std-x86_64-unknown-linux-gnu
"$LEAN_BRIDGE_RUST_PREFIX/bin/rustc" --version
