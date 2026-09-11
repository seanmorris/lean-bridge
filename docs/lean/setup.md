# Set up the author tools

Choose the package backend before installing its build tools. All current source builders use Lean 4.32.2.

| Target | Author tools | Runtime preparation |
| --- | --- | --- |
| [JavaScript / TypeScript (npm)](../publish/npm.md) | Node 22, Git, Lean 4.32.2, and Nix or Docker | Use the prepared CLI's bundled Wasm runtime. |
| Perl (CPAN) | Node 22, Lean 4.32.2, a C compiler, and the selected Perl interpreters on x86-64 Linux with glibc 2.38 or newer | The native build prepares its own matching Lean runtime and XS variants. |
| Python | The prepared native bundle, Python and pip; see [PyPI](../publish/pypi.md) | Install the matching native runtime package. |
| Rust | The prepared native bundle, Rust and Cargo; see [Cargo](../publish/cargo.md) | The generated crate selects its native runtime inputs. |
| C | The prepared native bundle, a C compiler, CMake or pkg-config; see [C packages](../publish/c.md) | Use the archive's runtime and link metadata. |
| C++ | The prepared native bundle, a C++ compiler and CMake; see [C++ packages](../publish/cpp.md) | Use the archive's runtime and link metadata. |
| C# / .NET | The prepared bundle and .NET SDK; see [NuGet](../publish/nuget.md) | Package the matching native library and runtime. |
| Java and Kotlin | The prepared bundle, JDK, Maven, and Kotlin tooling where used; see [Maven](../publish/maven.md) | Package the matching native library and runtime. |
| Ruby | The prepared bundle, Ruby and RubyGems; see [RubyGems](../publish/rubygems.md) | Package the matching native library and runtime. |
| Native PHP | PHP headers, the native compiler inputs, and Composer; see [PHP](../publish/php.md#native-php-with-composer) | Build the extension for the selected PHP ABI. |
| PHP-Wasm | The PHP-Wasm compiler inputs and npm; see [PHP](../publish/php.md#php-wasm-with-npm) | Use the matching PHP-Wasm transport and runtime. |
| WIT / WASI | The prepared component, native host, and compatible runner; see [WIT / WASI](../publish/wit-wasi.md) | Include the executable adapter and its native host. |

For Perl, use the [native build configuration and toolchain selection](../publish/cpan.md#build-an-ordinary-lean-project). The Nix `perl-build-engine` supplies the pinned compiler environment. The Wasm runtime checks below apply to npm only.

The table distinguishes tools used with prepared backend inputs from ordinary-source compilation. Shared export configuration does not add an ordinary-source compiler to a target. The [cross-language stages](../architecture/cross-language-authoring.md#stages) connect those missing paths; [target selection](../publishing.md) records their current inputs.

## Install a prepared CLI

Obtain a runtime-inclusive CLI archive and its reviewed SHA-256 from the maintainer. The CLI has no public npm release yet. Contributors can [build and test a standalone candidate](../contributing/testing.md#standalone-cli-package).

Set the archive's absolute path and allocate a work directory:

```sh
export LEAN_BRIDGE_CLI_ARCHIVE=/absolute/path/to/lean-bridge-0.1.0-rc.1.tgz
export LEAN_BRIDGE_WORK=$(mktemp -d)
sha256sum "$LEAN_BRIDGE_CLI_ARCHIVE"
tar -xOf "$LEAN_BRIDGE_CLI_ARCHIVE" package/cli-package-inventory.json
```

Compare the hash with the maintainer's reviewed value and check that the inventory has `runtimeIncluded: true`. A runtime-free candidate supports [receipt verification](../consume/receive-package.md#install-the-verifier-cli) and packaging tests, but lacks the runtime needed to prepare component archives.

Install the verified archive into the work directory:

```sh
npm install --prefix "$LEAN_BRIDGE_WORK/cli" --offline --ignore-scripts --no-audit --no-fund "$LEAN_BRIDGE_CLI_ARCHIVE"
export PATH="$LEAN_BRIDGE_WORK/cli/node_modules/.bin:$PATH"
lean-bridge --version
lean-bridge --help
```

The prepared CLI uses its bundled shared runtime automatically. Leave `LEAN_BRIDGE_RUNTIME_ROOT` unset for this path. You do not need a Lean Bridge checkout. Keep the work directory for the author tutorial and its separate test application.

## Select the build backend

For the npm component backend, choose Docker or Nix. Native Perl does not use this Wasm builder selection.

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

Continue with [a new component](first-component.md) or [an existing library](existing-package.md). The checkout setup has moved to Contributing; the links below preserve its existing bookmarks.

## Install the local CLI

Follow [Install the local CLI](../contributing/author-toolchain.md#install-the-local-cli) in Contributing.

## Prepare the shared runtime with Nix

Follow [Prepare the shared runtime with Nix](../contributing/author-toolchain.md#prepare-the-shared-runtime-with-nix) in Contributing.

## Prepare the shared runtime with Docker

Follow [Prepare the shared runtime with Docker](../contributing/author-toolchain.md#prepare-the-shared-runtime-with-docker) in Contributing.

## Use the checkout's Lean compiler

Follow [Use the checkout's Lean compiler](../contributing/author-toolchain.md#use-the-checkouts-lean-compiler) in Contributing.

## Confirm the runtime files

Follow [Confirm the runtime files](../contributing/author-toolchain.md#confirm-the-runtime-files) in Contributing.
