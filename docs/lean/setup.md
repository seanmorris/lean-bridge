# Set up the author tools

Install Node 22, Git, and either Nix or Docker. The tutorial's local proof check uses Lean 4.32.2.

## Install a prepared CLI

Obtain a runtime-inclusive CLI archive and its reviewed SHA-256 from the maintainer. The CLI has no public npm release yet. Contributors can [build and test a standalone candidate](../contributing/testing.md#standalone-cli-package).

Set the archive's absolute path and allocate a work directory:

```sh
export LEAN_BRIDGE_CLI_ARCHIVE=/absolute/path/to/lean-bridge-0.1.0-rc.1.tgz
export LEAN_BRIDGE_WORK=$(mktemp -d)
sha256sum "$LEAN_BRIDGE_CLI_ARCHIVE"
tar -xOf "$LEAN_BRIDGE_CLI_ARCHIVE" package/cli-package-inventory.json
```

Compare the hash with the maintainer's reviewed value and check that the inventory has `runtimeIncluded: true`. A source-only candidate is for packaging tests and lacks the runtime needed to prepare component archives.

Install the verified archive into the work directory:

```sh
npm install --prefix "$LEAN_BRIDGE_WORK/cli" --offline --ignore-scripts --no-audit --no-fund "$LEAN_BRIDGE_CLI_ARCHIVE"
export PATH="$LEAN_BRIDGE_WORK/cli/node_modules/.bin:$PATH"
lean-bridge --version
lean-bridge --help
```

The prepared CLI uses its bundled shared runtime automatically. Leave `LEAN_BRIDGE_RUNTIME_ROOT` unset for this path. You do not need a Lean Bridge checkout. Keep the work directory and reuse it throughout the author and consumer examples.

## Select the build backend

For Docker, start the daemon and select it:

```sh
docker info
export LEAN_BRIDGE_BUILD_BACKEND=docker
```

For Nix, enable flakes and `nix-command` in your Nix configuration, then select it:

```sh
nix --version
export LEAN_BRIDGE_BUILD_BACKEND=nix
```

The CLI uses its packaged, pinned builder inputs. Docker builds the pinned image locally unless you supply a reviewed image digest. The first build may download and compile those inputs. Distribution of the prepared builder image and signed Nix cache remains part of the [release plan](../architecture/npm-release-plan.md#runtime-and-builder-distribution).

Check the host and available work space:

```sh
node --version
git --version
df -h "$LEAN_BRIDGE_WORK"
```

## Check Lean locally

If your Lean development environment uses elan, install and check the tutorial's compiler:

```sh
elan toolchain install leanprover/lean4:v4.32.2
elan run leanprover/lean4:v4.32.2 lean --version
```

The tutorial's `lean-toolchain` file selects that version when you run `lean` from its project directory. If you use a direct compiler installation, check `lean --version` and confirm `4.32.2`.

Continue with [your first component](first-component.md). The remaining sections describe the alternative checkout-based setup for contributors.

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

Both commands must succeed for the checkout-based setup. If either fails, finish the selected runtime build before running the package dry run. Continue with [your first component](first-component.md).
