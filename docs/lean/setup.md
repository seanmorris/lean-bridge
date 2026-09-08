# Set up the author tools

Install Node 22, Git, and either Nix or Docker. Use a local Lean Bridge checkout; the CLI has no registry release.

## Install the local CLI

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

## Check Lean locally

The proof lesson uses Lean 4.32.2. If `lean` already resolves to that version, use it directly:

```sh
lean --version
```

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

Both commands must succeed. If either fails, finish the selected runtime build before running the package dry run. Continue with [your first component](first-component.md).
