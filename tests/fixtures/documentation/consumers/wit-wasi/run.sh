#!/bin/sh
set -eu

package_root=${1:?Usage: sh run.sh /absolute/path/to/lean-bridge-alpha-wasi-0.0.0}
"$package_root/bin/lean-alpha-wasi-host"
"$package_root/bin/lean-alpha-wasi-host" \
  "$package_root/component/lean-alpha.component.wasm" 73
