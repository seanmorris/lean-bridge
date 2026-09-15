# Build the author toolchain from a checkout

Use this setup when developing Lean Bridge. Package authors can [install the prepared CLI](../lean/setup.md) without a checkout or manual shared-runtime build.

## Install the local CLI

Use this path when developing Lean Bridge from source. Prepared-archive users can skip this section and the manual runtime builds below.

Set the checkout path and allocate a work directory:

```sh
export LEAN_BRIDGE_CHECKOUT=/path/to/lean-bridge
export LEAN_BRIDGE_WORK=$(mktemp -d)
npm install --global --ignore-scripts --no-audit --no-fund "$LEAN_BRIDGE_CHECKOUT"
lean-bridge --help
```

Keep the work directory for the project and its outputs. Reuse it throughout the author and consumer examples.

Check the host before preparing the runtime:

```sh
node --version
git --version
command -v nix || command -v docker
df -h "$LEAN_BRIDGE_WORK"
```

The repository pins the builder inputs in [flake.lock](../../flake.lock), [the Docker manifest](../../containers/builder/manifest.json), [lean-toolchain](../../lean-toolchain), and [the runtime graph lock](../../poc/lean-link-spike/graph-lock.json).

## Prepare the shared runtime with Nix

Nix needs flakes and the `nix-command` feature:

```sh
nix --extra-experimental-features 'nix-command flakes' \
  build "$LEAN_BRIDGE_CHECKOUT#universal-core-artifacts" \
  --out-link "$LEAN_BRIDGE_WORK/runtime"
export LEAN_BRIDGE_RUNTIME_ROOT="$LEAN_BRIDGE_WORK/runtime/lazy"
export LEAN_BRIDGE_BUILD_BACKEND=nix
```

Each component package uses this shared runtime. Prepare it once and reuse its store across author sessions.

## Prepare the shared runtime with Docker

Start the Docker daemon, then run:

```sh
cd "$LEAN_BRIDGE_CHECKOUT"
npm ci
npm run bootstrap
npm run build:lean-link-spike
npm run build:builder-image
export LEAN_BRIDGE_RUNTIME_ROOT="$LEAN_BRIDGE_CHECKOUT/build/lean-link-spike/lazy"
export LEAN_BRIDGE_BUILD_BACKEND=docker
```

The build checks the local image against the pinned builder manifest. A different image tag cannot substitute for that check.

## Use the checkout's Lean compiler

The checkout's bootstrap installs the pinned compiler locally. To use that copy:

```sh
cd "$LEAN_BRIDGE_CHECKOUT"
npm run bootstrap
export PATH="$LEAN_BRIDGE_CHECKOUT/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin:$PATH"
lean --version
```

Expect version `4.32.2`. The local check verifies the tutorial's proof before packaging; the isolated builder also checks its compiler identity against the shared runtime.

## Confirm the runtime files

```sh
test -f "$LEAN_BRIDGE_RUNTIME_ROOT/main.mjs"
test -f "$LEAN_BRIDGE_RUNTIME_ROOT/main.wasm"
```

Both commands must succeed for the checkout-based setup. If either fails, finish the selected runtime build before running the package dry run. Continue with [your first component](../lean/first-component.md).

## PHP-Wasm

Ordinary PHP-Wasm builds use Lean 4.32.2, Emscripten 3.1.68 and PHP 8.4.1 headers. The runtime-inclusive CLI's JavaScript runtime cannot substitute for this ABI. Until these build inputs have a prepared distribution, produce them from a Lean Bridge checkout.

Install the prerequisites listed by [the PHP-Wasm bootstrap](../../scripts/bootstrap-php-wasm-ci.sh), including the PHP configure tools. From the checkout:

```sh
npm ci --ignore-scripts
bash scripts/bootstrap-toolchains.sh
bash scripts/bootstrap-php-wasm-ci.sh
(
  export LEAN_WASM_EMSDK="$PWD/.toolchains/emsdk-php-wasm"
  export LEAN_WASM_RUNTIME_PROFILE=browser
  export LEAN_WASM_RUNTIME_VARIANT=php-wasm-3.1.68
  export LEAN_WASM_ARTIFACT_TARGET=php-wasm-emscripten-3.1.68
  source scripts/env.sh
  source scripts/lean-runtime-config.sh
  bash scripts/build-lean-runtime.sh
  printf 'LEAN_BRIDGE_PHP_LEAN_RUNTIME=%s/build/lean-runtime/%s\n' \
    "$PWD" "$LEAN_WASM_RUNTIME_BUILD_ID"
)
export LEAN_BRIDGE_LEAN_PREFIX="$PWD/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
export LEAN_BRIDGE_PHP_EMSDK="$PWD/.toolchains/emsdk-php-wasm"
export LEAN_BRIDGE_PHP_SOURCE="$PWD/build/php-wasm-sdk/php8.4-src"
```

Set `LEAN_BRIDGE_PHP_LEAN_RUNTIME` to the absolute directory printed above when using an installed CLI outside the checkout. The public [PHP-Wasm build command](../publish/php.md#build-an-ordinary-php-wasm-package) links the runtime from those pinned target archives. SDK and header inputs must remain available for component compilation.

To reuse a runtime from a completed ordinary PHP-Wasm release, set `LEAN_BRIDGE_PHP_COPIED_RUNTIME` to that release's `php-wasm/runtime/` directory. The builder checks its receipt and file inventory before copying it. Components are still compiled afresh; `--cache-directory` is not supported for this target. Keep `LEAN_BRIDGE_RUNTIME_ROOT` for JavaScript-Wasm only.
