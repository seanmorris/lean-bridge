# Build example packages and run checks

Run repository tests from a Lean Bridge checkout. Consumer applications use the [language guides](../consume.md); the commands here build test packages and execute the checked-in examples.

Use Node 22.22 or newer and Git. The Alpha package builds require Nix on x86-64 Linux with the `nix-command` and `flakes` features. The pinned flake supplies the native and managed compiler environments. Keep enough disk space for the build closure and temporary installed consumers.

Install the checkout's dependencies before running its Node scripts:

```sh
npm ci --ignore-scripts
mkdir -p build
```

## Build the example artifacts as a maintainer

Build the universal Alpha bundle, then project its Python, Rust, C, and C++ packages:

```sh
nix --extra-experimental-features 'nix-command flakes' build \
  .#universal-release-bundle --out-link build/consumer-universal-bundle
node scripts/build-pypi-package.mjs \
  --bundle build/consumer-universal-bundle --output build/example-python
node scripts/build-cargo-package.mjs \
  --bundle build/consumer-universal-bundle --output build/example-rust
node scripts/build-c-family-package.mjs --ecosystem c \
  --bundle build/consumer-universal-bundle --output build/example-c
node scripts/build-c-family-package.mjs --ecosystem cpp \
  --bundle build/consumer-universal-bundle --output build/example-cpp
```

Each projection output directory must be absent or empty. The commands produce local Alpha example artifacts without signing or publishing them. The [package handoff](../consume/receive-package.md) describes authentication before installation; the [ecosystem publishing guides](../publishing.md) describe release preparation.

To obtain approved flake outputs from a binary cache, use [signed Nix package consumption](../publish/nix.md). Authenticate the cache's public key and check substitution. Its cache signature and a Lean Bridge archive receipt cover different records.

## Managed packages

Build the NuGet package, Maven repository, and Ruby gem from the same pinned Alpha bundle:

```sh
nix --extra-experimental-features 'nix-command flakes' build \
  .#nuget-package --out-link build/consumer-managed-nuget
nix --extra-experimental-features 'nix-command flakes' build \
  .#maven-package --out-link build/consumer-managed-maven
nix --extra-experimental-features 'nix-command flakes' build \
  .#rubygems-package --out-link build/consumer-managed-rubygems
```

The outputs contain `LeanBridge.Alpha.0.0.0.nupkg`, `repository/org/leanbridge/lean-alpha/0.0.0/lean-alpha-0.0.0.jar` with its POM, and `lean_bridge_alpha-0.0.0.gem`, respectively. Their application examples require .NET 8, JDK 22, Kotlin for the Kotlin example, and MRI Ruby 3.3. Use the [consumer acceptance command](#consumer-acceptance) to run them inside the pinned environment.

The [managed runner](../../scripts/test-managed-registry-consumers.mjs) installs the original packages and executes the C#, Java, Kotlin, and Ruby programs. It checks copied payloads, identity, callback failures, returned callables, repeated close, and closed-resource errors. Separate checks cover composition, isolated Java class loaders, Ruby GC compaction, and performance. See [managed acceptance evidence](../evidence/managed-consumer-acceptance.md).

## Native PHP package

Nix builds the PHP 8.2 NTS Alpha package for x86-64 Linux:

```sh
nix --extra-experimental-features 'nix-command flakes' \
  build .#php-native-package --out-link build/consumer-php-native
export LEAN_ALPHA_PHP_PACKAGE=$(readlink -f build/consumer-php-native)
```

The output includes `lib/php/lean_alpha.so`, the shared Lean runtime, and `share/php/component/composer.json`. The [native PHP guide](../php.md#native-php) installs those Composer sources and runs the application. The [native release record](../evidence/native-php-release-package.md) records the producer's pinned toolchain. The installed consumer check below uses the matching PHP and Composer from Nix.

## WASI package

Build the universal bundle and project its WIT/WASI archive into a new directory:

```sh
nix --extra-experimental-features 'nix-command flakes' \
  build .#universal-release-bundle --out-link build/consumer-universal-bundle
node scripts/build-wasi-package.mjs \
  --bundle build/consumer-universal-bundle \
  --output build/documentation-wasi-release
```

The projection directory must be absent or empty. It contains `lean-bridge-alpha-wasi-0.0.0.tar.gz`, including the component, Wasmtime host, native Lean libraries, and WIT declarations. Follow the [WIT/WASI guide](../consume/wit-wasi.md) to extract and run it. The [acceptance record](../evidence/wasi-consumer-acceptance.md) identifies the tested Wasmtime and wasm-tools versions.

## Locked Lake dependency builds

The Node-only input tests need Git but no Lean compiler:

```sh
node --test tests/lake-dependency-snapshot.test.mjs tests/lake-component-input.test.mjs tests/lake-native-inputs.test.mjs
node --test tests/lake-generator-contract.test.mjs
```

Run the relocated npm acceptance through the pinned Nix engine and its shared runtime:

```sh
nix build .#component-build-engine --out-link build/locked-lake-engine
nix build .#universal-core-artifacts --out-link build/locked-lake-runtime
LEAN_BRIDGE_LAKE_WASM_TEST=1 \
LEAN_BRIDGE_LAKE_ENGINE=build/locked-lake-engine/bin/lean-bridge-component-engine \
LEAN_BRIDGE_LAKE_RUNTIME_ROOT=build/locked-lake-runtime/lazy \
node --test tests/lake-wasm.test.mjs
```

This compiles two unrelated dependency-importing projects after their original paths become unavailable, compares relocated releases, installs both npm archives offline, and invokes their public APIs. The cases cover custom source layouts and declared C inputs with captured headers. The consumer CI workflow runs these cases too.

With the local pinned Lean/Emscripten toolchains and `build/lean-link-spike/lazy` prepared, unset the two path overrides and run `LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/lake-wasm.test.mjs`. This also exercises linker rejection of changed resolution, module order, C headers, source identity, and fresh interface files, plus unreviewed foreign-call rejection. The [C-input acceptance record](../evidence/lake-c-inputs-20260911.md) lists the tested scope and remaining dependency work.

### Captured text generators

The internal generator runner needs the pinned Lean compiler, Git, and a C compiler:

```sh
bash scripts/bootstrap-toolchains.sh --lean-only
LEAN_BRIDGE_LAKE_GENERATOR_TEST=1 node --test --test-concurrency=1 \
  tests/lake-generators.test.mjs tests/lake-generator-prerequisites.test.mjs \
  tests/lake-generated-workspace.test.mjs
```

The tests compare relocated generator receipts, compile the resulting Lean source and C header, reject unreviewed implementations and changed staging files, and check cleanup after failure and cancellation. The prerequisite suite uses Lake to select declared recipes and resolve tool imports without invoking target bodies. It covers dependency-owned tools, unused targets, generation cycles, and receipt tampering.

The generated-workspace suite stages those outputs separately from the original capture, asks Lake to resolve their imports, then compiles the complete application closure and generated C translation unit. It rejects changed output origins, additional prerequisites, import cycles, missing modules, symlinks, extra files and staging drift. Both relocation fixtures run after their original paths become unavailable. The [generated-workspace acceptance record](../evidence/lake-generated-workspace-20260912.md) describes the internal APIs.

Installed generated-package checks require Perl and the prepared WASM runtime in addition to Lean and Emscripten:

```sh
source scripts/env.sh
LEAN_BRIDGE_LAKE_GENERATED_PACKAGES_TEST=1 \
  node --test tests/lake-generated-packages.test.mjs
```

These checks compare relocated npm and CPAN archives, invoke generated-value APIs after installation, verify publication dry runs, and reject changed handoffs before linking. Use `--test-name-pattern='generated native'` for the Perl-only cases. The Node consumer CI job uses the pinned Nix engine for the npm and publication cases; direct local compiler/linker rejection tests require the local toolchains.

These suites hash the selected compiler's complete `lib/lean` tree and take several minutes. The consumer workflows run them after installing the required tools. See the [generated-package acceptance record](../evidence/lake-generated-packages-20260912.md).

## Standalone CLI package

Check the reviewed source allowlist and the tarball-installed executable:

```sh
npm run test:cli-package
```

This checks deterministic archive bytes, excluded private files, executable permissions, local/global/npm-exec installation, and analysis from a read-only installation. It requires Node and npm, without Lean or a build backend.

For the full author check, prepare the existing shared runtime, then package that runtime with the CLI into a new directory:

```sh
npm run build:cli-package -- \
  --runtime build/consumer-ci-runtime/lazy --output build/cli-package
npm run acceptance:cli-package -- \
  --candidate build/cli-package --output build/cli-package-acceptance --backend nix
```

`build/consumer-ci-runtime/lazy` is the `universal-core-artifacts` runtime prepared by `npm run test:consumer:node`. Another reviewed runtime directory can be supplied explicitly. Select `--backend docker` when using Docker. The daemon must see the same filesystem paths as the CLI installation and acceptance output.

The acceptance runner installs the original CLI tarball with scripts disabled, creates an independent committed Lake project, builds and reproduces its packages without a runtime-path override, then calls the generated exports from a separate installed consumer. It retains the candidate reports and command logs, and removes its own scratch directory after success. It performs no registry upload.

Without `--runtime`, the packager creates a source-only candidate for packaging tests. Runtime correctness, registry acceptance, namespace ownership, and release approval remain required before publication.

## Reference package examples

The API and runtime-composition guides use the prepared `onboarding-small` and `onboarding-scalars` releases. To verify their examples, supply both package directories from checked builds with the same exact runtime dependency:

```sh
node scripts/check-reference-packages.mjs \
  --tutorial /path/to/tutorial-packages \
  --scalars /path/to/scalar-packages \
  --output build/reference-package-acceptance
```

Each input directory must contain `component-package-receipt.json` and its original runtime and component archives. The output directory must not exist. This is a contributor check; downstream applications follow the normal installation guide.

The runner verifies both receipts, installs the archives offline with scripts disabled, and compares the installed declaration files with the generated API reference. It executes the documentation's unmodified imports, checks large integers, invalid types, copied bytes, and strict TypeScript errors, then bundles the same examples for Chromium, Firefox, and WebKit. The browser check expects one shared runtime binary and two component binaries, including after a repeated import.

The result and package identities are retained in `report.json` under the output directory. No registry upload occurs. The input packages must come from the same intended runtime build; a mismatched dependency fails before installation.

## Local registry rehearsal

Rehearse publication against a disposable local registry:

```sh
npm install --prefix build/registry-tools --ignore-scripts --no-audit --no-fund verdaccio@6.2.0
node scripts/check-local-npm-release.mjs \
  --verdaccio build/registry-tools/node_modules/.bin/verdaccio \
  --candidate build/cli-package --output build/cli-registry-acceptance \
  --backend nix --browsers chromium,firefox,webkit
```

Install the requested Playwright browser engines first. The runner creates a loopback-only registry without upstream package publishing, installs the CLI by coordinate, builds an independent committed author project, and publishes its signed component. It checks missing-runtime rejection, hostile npm configuration, and completed-transaction retry. Node, strict TypeScript, plain browser JavaScript, React, and workers install the component without naming its runtime; npm resolves that dependency. Third-party frontend tools come from the normal npm registry.

The runner removes its registry storage and successful consumer scratch directories. Reports contain public policy and artifact hashes, not signing keys or registry tokens. GitHub CI runs this rehearsal; it does not publish to public npm.

## Author acceptance

Complete the [checkout-based author setup](author-toolchain.md#install-the-local-cli) first. Keep its `LEAN_BRIDGE_CHECKOUT`, `LEAN_BRIDGE_WORK`, `LEAN_BRIDGE_RUNTIME_ROOT`, and `LEAN_BRIDGE_BUILD_BACKEND` variables, and make sure `lean` selects the pinned compiler. The shared runtime must already contain `main.mjs` and `main.wasm`. To check a prepared CLI archive without a checkout or runtime override, use the [standalone CLI acceptance runner](#standalone-cli-package) instead.

Run the [author tutorial runner](../../scripts/check-lean-author-tutorial.mjs) with a fresh output directory:

```sh
node "$LEAN_BRIDGE_CHECKOUT/scripts/check-lean-author-tutorial.mjs" \
  --backend "$LEAN_BRIDGE_BUILD_BACKEND" \
  --runtime "$LEAN_BRIDGE_RUNTIME_ROOT" \
  --lean "$(command -v lean)" \
  --output "$LEAN_BRIDGE_WORK/author-acceptance"
```

The runner checks the theorem with warnings treated as errors, rejects a changed implementation and an admitted proof, analyzes the exports, compares two clean builds, verifies the copied receipt, and calls the installed package. A successful run writes `author-acceptance.json` with `status: "passed"` and keeps its command logs in `evidence/author-commands.json`. It does not upload a package.

For a mounted-checkout ownership failure, use a task-owned copy of the committed engine source as described in [author diagnostics](../lean/diagnostics.md#docker-reports-repository-ownership):

```sh
node "$LEAN_BRIDGE_CHECKOUT/scripts/check-lean-author-tutorial.mjs" \
  --backend docker \
  --engine /path/to/owned-engine-copy \
  --runtime "$LEAN_BRIDGE_RUNTIME_ROOT" \
  --output "$LEAN_BRIDGE_WORK/author-acceptance"
```

`--engine` selects that copy's unchanged CLI and builder inputs. `--runtime` selects the prepared shared runtime; `--lean` selects the proof checker. Without overrides, the runner uses this checkout and its bootstrapped compiler. Choose another absent output path if an earlier attempt created the example path.

The runner creates and commits its fixture in a separate temporary repository. It retains that directory and command logs on failure and removes only its own temporary workspace after success.

## JavaScript and browser acceptance

Use the completed `onboarding-small@1.0.0` npm handoff from the [author tutorial](../lean/first-component.md#create-and-verify-local-archives). Set `LEAN_BRIDGE_RELEASE` to its absolute `release/packages/npm` directory, containing the receipt, verifier, and both original archives. The [receipt verification instructions](../consume/receive-package.md#verify-the-local-npm-receipt) identify those files.

Install the browser engines from the checkout. `--with-deps` also installs browser system dependencies and may require administrator access:

```sh
npx playwright install --with-deps chromium firefox webkit
```

Run the [installed consumer acceptance](../../scripts/check-component-browser-consumer.mjs):

```sh
node scripts/check-component-browser-consumer.mjs \
  --release "$LEAN_BRIDGE_RELEASE" \
  --output build/documentation-consumer-acceptance
```

The command verifies the supplied archives, installs them in an external temporary project, type-checks the fixtures, and exercises Node, plain browser JavaScript, production React, development StrictMode, and module workers in Chromium, Firefox, and WebKit.

It checks loading, unmount during loading, invalid input, exact large-integer arithmetic, failed assets, reload recovery, and deployment prefixes. A successful run writes `acceptance.json` with `status: "passed"`. The adjacent `numeric-boundary-diagnostic.json` records successful addition at the 31-bit and 64-bit boundaries and for an input above `2^4096`. Acceptance neither rebuilds the component nor publishes it.

## Consumer acceptance

Choose the command for the package boundary you changed. These commands run from the checkout, build the required packages, and install them into clean consumer projects. Native and managed jobs use the pinned Nix environment. The browser job needs Playwright's Chromium installed. The Node job also runs browser acceptance when `LEAN_BRIDGE_DOCUMENTATION_BROWSERS` names the requested engines, such as `chromium,firefox,webkit`; install those engines first.

| Command | Installed boundary |
| --- | --- |
| `npm run test:consumer:native` | Python, Rust, C, and C++ archives. |
| `npm run test:consumer:managed` | NuGet, Maven for Java and Kotlin, and RubyGems. |
| `npm run test:consumer:perl` | CPAN distributions, all four Perl ABIs and both XS install paths. |
| `npm run test:consumer:node` | Alpha and the authored `onboarding-small` package in Node JavaScript and TypeScript, including the documentation fixtures. |
| `npm run test:consumer:browser` | Alpha's browser npm package. |
| `npm run test:consumer:php-native` | Native PHP extension, runtime, and Composer sources. |
| `npm run test:consumer:php-wasm` | PHP-Wasm host and generated package in lazy and startup profiles. |
| `npm run test:consumer:wasi` | Extracted WIT/WASI archive and its packaged host. |

The [native runner](../../scripts/test-native-consumers.mjs) installs the original release archives and executes the Python, Rust, C, and C++ guide files against real Lean. It retains its steady-state benchmark separately and writes `build/documentation-native-acceptance/acceptance.json`. Successful native and managed reports use `result: "passed"`; the managed report is `build/documentation-consumers/managed.json`.

The native PHP job installs the Composer sources and runs the guide's program; its separate conformance and performance checks run in the same job. The PHP-Wasm job prepares its pinned Emscripten 3.1.68 and PHP source inputs, installs the host and generated package in a clean Node project, and executes the checked-in PHP and host files as part of the native/lazy/startup release gate.

For changes spanning native PHP and both PHP-Wasm profiles, run `npm run test:php-release` in the pinned PHP build environment. This regression gate builds and tests the fixture profiles locally; it does not upload them.

The WIT/WASI job extracts its archive into a clean consumer, runs the checked-in shell example, and independently validates the component. That example prints `42` and `73` on separate lines. The job measures whole-process invocation cost separately from the tutorial.

Keep the command output and reports with the change. See the [native consumer evidence](../evidence/native-consumer-acceptance.md), [managed acceptance evidence](../evidence/managed-consumer-acceptance.md), [PHP release gate](../evidence/php-release-gate.md), and [WIT/WASI acceptance record](../evidence/wasi-consumer-acceptance.md) for the recorded checks.

### Perl packages

Build only the pinned Lean compiler with `bash scripts/bootstrap-toolchains.sh --lean-only`, then run `npm run test:consumer:perl` on x86-64 Linux with glibc 2.38 or newer. The suite builds checksummed Perl 5.36.3 and 5.38.2, with and without interpreter threads, and installs generated packages through both prebuilt and XS-only paths. It records archive identities and warmed benchmarks in `build/consumer-ci/perl/`, plus the aggregate performance observation in `build/consumer-ci/performance/perl.json`.

For development on an older glibc host, `LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36` lowers only the test package's declared floor. Do not publish those development packages as the production profile. `LEAN_BRIDGE_KEEP_PERL_TEST=1` preserves a suite's task-local build directory for inspection; otherwise it is removed after the run.

The native target accepts ordinary local Lean modules. Tests cover all sixteen scalars, copied records and arrays, shared resource identity, callbacks, returned closures, invalid inputs, runtime mismatch, compiler-free installation, and independent build reproducibility. Additional checks reject partial implementations, admitted definitions, dependent or generic signatures, unreviewed foreign code and scalar values incorrectly declared as identity resources.

## Release tooling checks

From the checkout with its Node dependencies installed, run the focused release tests:

```sh
npm run test:release-rehearsal
npm run test:release-authorization
npm run test:publication-attestation
npm run test:registry-transaction
node --test tests/npm-registry-adapter.test.mjs
npm run test:release-receipt
```

These tests use fixtures, temporary directories, and injected registry clients. They exercise rejection, retries, signatures, and exact archive checks without uploading packages. A passing test run does not establish that an actual sandbox accepted a release. Use the [sandbox publishing guide](sandbox-release.md#rehearse-a-registry-release) for an authorized registry transaction.
