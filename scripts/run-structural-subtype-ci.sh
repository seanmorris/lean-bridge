#!/usr/bin/env bash
# Keep both original author routes, complete installed records, and failures for one required lane.
set -euo pipefail

if [[ $# != 1 ]]; then
  printf '%s\n' 'Usage: run-structural-subtype-ci.sh <c-cpp|python311|python312|rust|ruby|dotnet|jvm|php-native|wit-wasi|perl|node-browser|php-wasm>' >&2
  exit 2
fi
lane=$1
host=''
extra=(--glibc 2.38)
case "$lane" in
  c-cpp) prefix=LEAN_BRIDGE_STRUCTURAL_SUBTYPE; file=tests/structural-subtype-installed.test.mjs; label='' ;;
  python311|python312) prefix=LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PYTHON; host=python; label="Python 3.${lane#python3}" ;;
  rust) prefix=LEAN_BRIDGE_STRUCTURAL_SUBTYPE_RUST; host=rust; label=Rust ;;
  ruby) prefix=LEAN_BRIDGE_STRUCTURAL_SUBTYPE_RUBY; host=ruby; label=Ruby ;;
  dotnet) prefix=LEAN_BRIDGE_STRUCTURAL_SUBTYPE_DOTNET; host=dotnet; label=Dotnet ;;
  jvm) prefix=LEAN_BRIDGE_STRUCTURAL_SUBTYPE_JVM; host=jvm; label=JVM ;;
  php-native) prefix=LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP; host=php; label=PHP ;;
  wit-wasi) prefix=LEAN_BRIDGE_STRUCTURAL_SUBTYPE_WIT; host=wit; label=WIT ;;
  perl) prefix=LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PERL; host=perl; label='' ;;
  node-browser) prefix=LEAN_BRIDGE_STRUCTURAL_SUBTYPE_NPM; file=tests/structural-subtype-npm-installed.test.mjs; label=''; extra=() ;;
  php-wasm) prefix=LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_WASM; host=php-wasm; label=PHP-Wasm; extra=() ;;
  *) printf 'Unknown structural Subtype CI lane: %s\n' "$lane" >&2; exit 2 ;;
esac
if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR || -v LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR || -v LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PERLS ]]; then
  printf '%s\n' 'Hosted structural acceptance requires the default glibc 2.38 floor and pinned four-ABI Perl toolchains.' >&2
  exit 2
fi
if [[ "$lane" == c-cpp ]]; then
  export LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PROFILES=c,cpp
else
  export "${prefix}_TEST=1"
fi
if [[ "$lane" == python311 || "$lane" == python312 ]]; then
  export LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PYTHON_MINOR="3.${lane#python3}"
fi
if [[ "$lane" == node-browser ]]; then
  export LEAN_BRIDGE_STRUCTURAL_SUBTYPE_BROWSER_TEST=1
  export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit
fi
if [[ -n "$host" ]]; then file="tests/helpers/structural-subtype-$host-installed-tests.mjs"; fi
revision=$(git rev-parse HEAD)
output_root="build/structural-subtype-ci/$lane"
mkdir -p build/structural-subtype-ci
# Refuse stale or partial output before launching a producer or opening its log.
mkdir "$output_root"
for route in ordinary reviewed; do
  output="$output_root/$route"
  mkdir "$output"
  case "$lane" in
    c-cpp) name="installed structural Subtypes reproduce and relocate $route" ;;
    node-browser) name="installed npm structural Subtypes reproduce and relocate $route" ;;
    perl) name="installed structural-subtype Perl packages reproduce and relocate both delivery modes for $route" ;;
    *) name="installed structural Subtypes $label $route reproduce and relocate" ;;
  esac
  export "${prefix}_ROUTES=$route" "${prefix}_OUTPUT=$output/records"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    "$file" 2>&1 | tee "$output/run.tap"
  node scripts/check-structural-subtype-ci.mjs --lane "$lane" --route "$route" \
    --producer "$revision" --directory "$output/records/$route" --tap "$output/run.tap" "${extra[@]}"
done
