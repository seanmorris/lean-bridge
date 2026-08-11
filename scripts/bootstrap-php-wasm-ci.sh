#!/usr/bin/env bash

set -euo pipefail

LEAN_BRIDGE_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LEAN_BRIDGE_PHP_WASM_EMSDK="$LEAN_BRIDGE_PROJECT_ROOT/.toolchains/emsdk-php-wasm"
LEAN_BRIDGE_PHP_WASM_SDK="$LEAN_BRIDGE_PROJECT_ROOT/build/php-wasm-sdk"
LEAN_BRIDGE_PHP_WASM_SOURCE="$LEAN_BRIDGE_PHP_WASM_SDK/php-wasm-source"
LEAN_BRIDGE_PHP_SOURCE="$LEAN_BRIDGE_PHP_WASM_SDK/php8.4-src"
LEAN_BRIDGE_PHP_HOST="$LEAN_BRIDGE_PROJECT_ROOT/build/php-wasm-host"

LEAN_BRIDGE_EMSDK_VERSION=3.1.68
LEAN_BRIDGE_EMSDK_COMMIT=54ef088329e5a329614b3659a579d2ccd31fd621
LEAN_BRIDGE_EMSCRIPTEN_COMMIT=ceee49d2ecdab36a3feb85a684f8e5a453dde910
LEAN_BRIDGE_PHP_WASM_COMMIT=bd9a46bf4984bfbdfef4bb6f5b04b7dcd6264c89
LEAN_BRIDGE_PHP_COMMIT=0454901ed1518cfb42bc77ac91728591b58c3e6e

for command in autoconf automake bison flex git gperf libtoolize make npm re2c; do
  if ! command -v "$command" >/dev/null; then
    echo "bootstrap-php-wasm-ci requires $command" >&2
    exit 1
  fi
done

mkdir -p "$LEAN_BRIDGE_PROJECT_ROOT/.toolchains" "$LEAN_BRIDGE_PHP_WASM_SDK"

if [[ ! -d "$LEAN_BRIDGE_PHP_WASM_EMSDK/.git" ]]; then
  git clone --filter=blob:none --no-checkout \
    https://github.com/emscripten-core/emsdk.git \
    "$LEAN_BRIDGE_PHP_WASM_EMSDK"
fi
git -C "$LEAN_BRIDGE_PHP_WASM_EMSDK" fetch --depth 1 origin "$LEAN_BRIDGE_EMSDK_COMMIT"
git -C "$LEAN_BRIDGE_PHP_WASM_EMSDK" checkout --detach "$LEAN_BRIDGE_EMSDK_COMMIT"
"$LEAN_BRIDGE_PHP_WASM_EMSDK/emsdk" install "$LEAN_BRIDGE_EMSDK_VERSION"
"$LEAN_BRIDGE_PHP_WASM_EMSDK/emsdk" activate "$LEAN_BRIDGE_EMSDK_VERSION"

if [[ "$(git -C "$LEAN_BRIDGE_PHP_WASM_EMSDK" rev-parse HEAD)" != "$LEAN_BRIDGE_EMSDK_COMMIT" ]]; then
  echo "PHP-Wasm emsdk checkout does not match the package manifest" >&2
  exit 1
fi
LEAN_BRIDGE_EMCC_VERSION=$(
  "$LEAN_BRIDGE_PHP_WASM_EMSDK/upstream/emscripten/emcc" --version | sed -n '1p'
)
if [[ "$LEAN_BRIDGE_EMCC_VERSION" != *" $LEAN_BRIDGE_EMSDK_VERSION ($LEAN_BRIDGE_EMSCRIPTEN_COMMIT)"* ]]; then
  echo "PHP-Wasm emcc checkout does not match the package manifest" >&2
  exit 1
fi

if [[ ! -d "$LEAN_BRIDGE_PHP_WASM_SOURCE/.git" ]]; then
  git clone --filter=blob:none --no-checkout \
    https://github.com/seanmorris/php-wasm.git \
    "$LEAN_BRIDGE_PHP_WASM_SOURCE"
fi
git -C "$LEAN_BRIDGE_PHP_WASM_SOURCE" fetch --depth 1 origin "$LEAN_BRIDGE_PHP_WASM_COMMIT"
git -C "$LEAN_BRIDGE_PHP_WASM_SOURCE" checkout --detach "$LEAN_BRIDGE_PHP_WASM_COMMIT"

LEAN_BRIDGE_PHP_MARKER="$LEAN_BRIDGE_PHP_SOURCE/.lean-bridge-configured"
LEAN_BRIDGE_PHP_MARKER_VALUE="$LEAN_BRIDGE_PHP_COMMIT:$LEAN_BRIDGE_PHP_WASM_COMMIT:$LEAN_BRIDGE_EMSCRIPTEN_COMMIT"
if [[ ! -f "$LEAN_BRIDGE_PHP_MARKER" ]] || \
  [[ "$(<"$LEAN_BRIDGE_PHP_MARKER")" != "$LEAN_BRIDGE_PHP_MARKER_VALUE" ]] || \
  [[ ! -f "$LEAN_BRIDGE_PHP_SOURCE/config.h" ]]; then
  if [[ ! -d "$LEAN_BRIDGE_PHP_SOURCE/.git" ]]; then
    git clone --filter=blob:none --no-checkout \
      https://github.com/php/php-src.git \
      "$LEAN_BRIDGE_PHP_SOURCE"
  fi
  git -C "$LEAN_BRIDGE_PHP_SOURCE" fetch --depth 1 origin "$LEAN_BRIDGE_PHP_COMMIT"
  git -C "$LEAN_BRIDGE_PHP_SOURCE" checkout --detach --force "$LEAN_BRIDGE_PHP_COMMIT"
  git -C "$LEAN_BRIDGE_PHP_SOURCE" clean -ffdx
  git -C "$LEAN_BRIDGE_PROJECT_ROOT" apply --no-index -p2 \
    --directory=build/php-wasm-sdk \
    "$LEAN_BRIDGE_PHP_WASM_SOURCE/patch/php8.4.patch"
  cp -R "$LEAN_BRIDGE_PHP_WASM_SOURCE/source/pib" "$LEAN_BRIDGE_PHP_SOURCE/ext/pib"
  rm -f "$LEAN_BRIDGE_PHP_WASM_SDK/config-cache"
  printf '%s\n' '{"type":"commonjs"}' > "$LEAN_BRIDGE_PHP_SOURCE/package.json"

  # emsdk_env only exports the compiler paths used by PHP's configure scripts.
  # shellcheck disable=SC1091
  source "$LEAN_BRIDGE_PHP_WASM_EMSDK/emsdk_env.sh" >/dev/null
  pushd "$LEAN_BRIDGE_PHP_SOURCE" >/dev/null
  emconfigure ./buildconf --force
  emconfigure ./configure \
    --cache-file="$LEAN_BRIDGE_PHP_WASM_SDK/config-cache" \
    PKG_CONFIG_PATH="$LEAN_BRIDGE_PHP_WASM_SDK/lib/lib/pkgconfig" \
    EXTENSION_DIR=./ \
    --prefix="$LEAN_BRIDGE_PHP_WASM_SDK/lib/php8.4" \
    --with-config-file-path=/php.ini \
    --with-config-file-scan-dir=/config:/preload \
    --with-layout=GNU \
    --with-valgrind=no \
    --enable-cgi \
    --enable-phpdbg \
    --enable-cli \
    --enable-embed=static \
    --enable-pib \
    --enable-json \
    --enable-pdo \
    --disable-all \
    --disable-fiber-asm \
    --disable-rpath \
    --disable-opcache-jit \
    --without-pear \
    --without-pcre-jit \
    --enable-bcmath \
    --enable-calendar \
    --enable-ctype \
    --enable-exif \
    --enable-filter \
    --enable-session \
    --enable-tokenizer
  popd >/dev/null
  printf '%s\n' "$LEAN_BRIDGE_PHP_MARKER_VALUE" > "$LEAN_BRIDGE_PHP_MARKER"
fi

if [[ "$(git -C "$LEAN_BRIDGE_PHP_SOURCE" rev-parse HEAD)" != "$LEAN_BRIDGE_PHP_COMMIT" ]]; then
  echo "PHP source checkout does not match the pinned PHP 8.4.1 commit" >&2
  exit 1
fi

mkdir -p "$LEAN_BRIDGE_PHP_HOST"
if [[ ! -f "$LEAN_BRIDGE_PHP_HOST/package.json" ]]; then
  printf '%s\n' '{"private":true}' > "$LEAN_BRIDGE_PHP_HOST/package.json"
fi
npm install \
  --prefix "$LEAN_BRIDGE_PHP_HOST" \
  --ignore-scripts \
  --no-audit \
  --no-fund \
  --save-exact \
  php-wasm@0.1.0

node -e '
const fs = require("node:fs");
const lock = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const actual = lock.packages["node_modules/php-wasm"]?.integrity;
const expected = "sha512-8mqAUqYugBMT6YR8RC/5K2juvm31zO+KPdWI1Aij6KqFroCoDYSq2tLWTuIpJKx6Nq8o6gnI2jq5yjo3tK62hw==";
if (actual !== expected) throw new Error(`php-wasm integrity mismatch: ${actual}`);
' "$LEAN_BRIDGE_PHP_HOST/package-lock.json"

printf 'Prepared PHP-Wasm %s with Emscripten %s and PHP 8.4.1.\n' \
  "$LEAN_BRIDGE_PHP_WASM_COMMIT" "$LEAN_BRIDGE_EMSDK_VERSION"
