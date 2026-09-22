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

### Signed Nix cache recipes

With Nix 2.24+, Node 22, Bash and curl on PATH, run:

```sh
npm run test:nix-cache
```

The suite executes the signing, endpoint-verification and clean-fetch blocks from the publishing and consumer guides. It registers a two-path input-addressed fixture in a private store, generates temporary signing keys, and checks full-closure downloads through a file cache and a loopback HTTP server. Unsigned packages or dependencies, unrelated keys, modified references, corrupt archives and missing runtime archives must fail. It also checks key rotation and paths containing reserved URL characters. Each run removes its stores, keys and caches.

No Lean compilation, registry upload, public cache, active-store mutation or privileged daemon configuration is involved. These checks cover cache transport and trust; the separate consumer jobs build and execute the actual Lean packages. The downstream workflow runs this suite with Nix 2.24.11.

### Publication shell recipes

Run the prepared-archive shell checks with Node 22, Bash and GNU tar/coreutils:

```sh
node --test tests/publishing-recipes.test.mjs
```

These checks execute the npm, PyPI, NuGet, Maven, RubyGems and GitHub archive-upload snippets with recording clients. They check exact argument boundaries for unrelated package filenames, paths containing spaces, credential guards, unchanged input bytes and failed-command propagation. The Cargo checks preserve an ordinary package's lockfile and handle Alpha's optional VCS metadata. PATH contains only the recorders and the required filesystem tools; the suite makes no registry requests.

The recorders test shell behavior, not registry acceptance or archive validity. Installed-consumer suites cover generated package contents. PAUSE's web upload and Composer repository administration still need the operator checks in their publishing guides. The [publication recipe acceptance record](../evidence/publication-recipes-20260916.md) records the fixes, toolchain and executed checks.

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

### Ordinary-source NuGet packages

Install the pinned Lean compiler, a native C compiler and .NET SDK 8.0.424 on x86-64 Linux. Use glibc 2.38 or newer for the production native profile:

```sh
bash scripts/bootstrap-toolchains.sh --lean-only
source scripts/env.sh
LEAN_BRIDGE_NATIVE_DOTNET_TEST=1 \
  node --test --test-reporter=spec tests/native-dotnet.test.mjs
```

Set `LEAN_BRIDGE_DOTNET` to the SDK executable's absolute path if it is not on PATH. The suite builds unrelated Aurora and Boreal projects, compares relocated archives, hides the original sources, and executes offline-installed C# applications. It tests all primitive values, nested arrays and records, rejected inputs, cleanup, concurrent calls, package tampering and two packages sharing one Lean runtime. Cross-package callbacks, returned closures and nested exception identity use the same runtime. The [earlier NuGet acceptance record](../evidence/native-dotnet-20260914.md) retains the original copied-value archive hashes; the [callable record](../evidence/dotnet-callables-20260919.md) includes the rebuilt packages.

Run primitive callable acceptance on both ordinary-source and independently reviewed NuGet packages:

```sh
LEAN_BRIDGE_DOTNET_CALLABLE_TEST=1 node --test tests/dotnet-callables.test.mjs
```

This checks nineteen primitive mappings, one- and sixteen-argument callbacks and returned closures, exception identity/stack preservation, async delegate rejection, reentry limits, expired borrows, GC rooting, finalization, thread ownership and lease exhaustion. Seven invalid C# consumers must fail compilation. Installed executables repeat their checks with a relocated runtime containing no SDK or sources. Results are recorded in `build/callables/dotnet.json` and uploaded by the managed consumer CI job. A separate compiled contract test checks deferred active disposal and the process-change guard without forking the CLR.

For ordinary Rust crates, install Rust 1.90+ and Cargo. `scripts/bootstrap-rust-ci.sh` installs the SHA-256-pinned CI toolchain. Set `LEAN_BRIDGE_RUSTC` and `LEAN_BRIDGE_CARGO` when they are not on `PATH`, then run:

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_RUST_TEST=1 node --test tests/native-rust.test.mjs
```

This builds Cedar and Hazel twice, installs exact crates, exercises all primitive and nested copied values, injects conversion failures and unwinding, and runs moved binaries without their Cargo source trees. It checks shared-runtime composition, post-fork rejection, package drift and atomic build failure. Cargo dependencies must be cached for offline consumer checks; the author build fetches the pinned dependencies. The [Rust evidence](../evidence/native-rust-20260915.md) lists the local toolchain and archive hashes.

The Node consumer CI job also runs `tests/multi-profile-project.test.mjs` with `LEAN_BRIDGE_MULTI_PROFILE_TEST=1`. Shop builds npm, CPAN, C, C++, NuGet, Maven, RubyGems, WIT/WASI, PyPI, Cargo and native PHP from one captured API with one compilation per native/Wasm profile. This check additionally needs Emscripten, the prepared Wasm runtime, Perl, .NET, JDK 22, Ruby 3.3, Python 3.11+ with venv, Rust 1.90+ with Cargo, PHP CLI with FFI, Composer and the pinned Wasmtime C API.

### Ordinary-source Maven packages

Use the pinned Lean compiler, a native C compiler, JDK 22, Maven and Kotlin's JVM compiler/runner. CI uses Temurin 22.0.2 and the checksummed Kotlin 2.2.0 compiler archive. Run all JVM tools with the same JDK:

```sh
source scripts/env.sh
export LEAN_BRIDGE_JAVAC="$JAVA_HOME/bin/javac"
export LEAN_BRIDGE_JAVA="$JAVA_HOME/bin/java"
export LEAN_BRIDGE_KOTLINC=/absolute/path/to/kotlinc/bin/kotlinc
export LEAN_BRIDGE_KOTLIN=/absolute/path/to/kotlinc/bin/kotlin
LEAN_BRIDGE_NATIVE_JVM_TEST=1 \
  node --test --test-reporter=spec tests/native-jvm.test.mjs
```

Set `JAVA_HOME` to JDK 22 first, and set `LEAN_BRIDGE_MAVEN` if `mvn` is not on PATH. The suite compiles Maple and Cedar, compares relocated JAR/POM bytes, hides their sources, installs the archives with Maven and executes Java and Kotlin consumers. It checks exact primitives, nested arrays/records, rejection, cleanup, concurrent calls, tampering, class-loader isolation and two packages sharing one runtime. Cross-package callbacks, closures and nested exception identity use that shared runtime. Maven may download its pinned install plugin; the Lean packages come from the supplied files. The [earlier JVM acceptance record](../evidence/native-jvm-20260914.md) retains the copied-value archive hashes; the [callable record](../evidence/jvm-callables-20260919.md) records the rebuilt packages.

Run the independent Java and Kotlin primitive callable consumers on both source paths:

```sh
LEAN_BRIDGE_JVM_CALLABLE_TEST=1 \
  node --test tests/jvm-callables.test.mjs tests/jvm-callable-contract.test.mjs
```

This checks all nineteen primitives, sixteen-argument functions, exact integers, exception identity, copied callback storage, expired borrows, reentry, thread ownership, virtual-thread rejection and deterministic cleanup. Java also checks Cleaner recovery and creator-thread exit. Each language compiles six invalid callers against the installed JAR. Both repeat their assertions using a `jlink` runtime with only `java.base`, after deleting author and consumer sources and the Maven installation/cache. The compiled lifetime contract checks deferred active disposal and a simulated PID change without forking the JVM. Managed CI retains `build/callables/jvm.json`.

### Ordinary-source RubyGems packages

Use the pinned Lean compiler, a native C compiler and MRI Ruby 3.3 with RubyGems. CI uses Ruby 3.3.12. Set both executables to the same Ruby installation:

```sh
source scripts/env.sh
export LEAN_BRIDGE_RUBY=/absolute/path/to/ruby-3.3/bin/ruby
export LEAN_BRIDGE_GEM=/absolute/path/to/ruby-3.3/bin/gem
LEAN_BRIDGE_NATIVE_RUBY_TEST=1 \
  node --test --test-reporter=spec tests/native-ruby.test.mjs
```

Willow and Aspen each build from two relocated source trees. Their gems must match byte-for-byte. The suite hides both source locations, installs with RubyGems offline, and calls generated APIs without Lean or a C compiler. It covers all primitive values, arrays and record fields, nested values, strict rejection, allocation-failure cleanup, concurrent calls, GC compaction, tampering and two installed gems sharing one runtime. See the [Ruby acceptance record](../evidence/native-ruby-20260914.md).

Run the independent copied-array and record acceptance on both source paths:

```sh
LEAN_BRIDGE_RUBY_COLLECTION_TEST=1 \
  node --test tests/ruby-collections.test.mjs tests/ruby-collection-contract.test.mjs
```

The 35-export contract covers all nineteen primitive elements and fields, seven
records and 24 fixed Array nesting levels. Consumers install original gems
offline, remove producer sources and handoffs, relocate the installation and
execute without compilers. They check independent copies, field meanings,
nominal value equality, exact integers, float bit cases, Unicode, malformed
inputs, budgets, GC compaction and threads. Overridden String and Array methods
must not change copy lengths or element selection.

A separate process injects conversion, allocation, buffer-retention and record
construction failures in memory. It checks native output cleanup, every retained
scratch pointer, partial invalid inputs and malformed sequence/Char outputs.
Public consumers execute before and after the probe, and all installed files
must retain their original identities. Managed CI requires
`build/collections/ruby.json`. The [collection record](../evidence/ruby-collections-20260922.md)
retains the independent rebuild and executed documentation example.

## Native PHP package

For ordinary Composer packages, install the C author tools, PHP 8.2+ CLI with FFI, and Composer 2 with ZIP support:

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_PHP_TEST=1 node --test tests/native-php.test.mjs
```

This builds unrelated Clover and Juniper projects twice, installs relocated ZIPs with Composer, executes all copied primitives, arrays and records, and checks strict validation, cleanup, shared loading, fork rejection and archive drift. The [PHP evidence](../evidence/native-php-copied-20260915.md) records the local toolchain and explicit glibc test override. The PHP consumer CI job requires this suite, the Alpha transport checks below, the copied Zend boundary check, and ordinary PHP-Wasm compilation.

The native suite also tests cross-package callbacks, returned functions and nested exception identity. Run the independent primitive callable acceptance with:

```sh
LEAN_BRIDGE_PHP_CALLABLE_TEST=1 \
  node --test tests/php-callables.test.mjs tests/php-callable-contract.test.mjs
```

This checks all nineteen primitive signatures and sixteen-argument functions on ordinary-source and independently reviewed Composer paths. Weak and strict callers each run twice after relocation, without author sources, compilers, Composer caches or runtime overrides. It checks exact values, exception identity, borrowed lifetime, reentry, alias lifetime, deterministic disposal, destructor recovery, capacity limits, fiber rejection and post-fork rejection. A 20,000-callback stress test checks retained memory after warm-up. A separate production-state contract checks deferred active close. CI retains `build/callables/php-native.json`; the [acceptance record](../evidence/php-callables-20260919.md) identifies the installed archives.

Run the independent native compound acceptance with the same PHP and Composer tools:

```sh
LEAN_BRIDGE_PHP_COMPOUND_TEST=1 \
  node --test tests/php-compounds.test.mjs tests/php-compound-contract.test.mjs
```

Both source paths build 64 exports covering nineteen primitives in options,
results and nested binary products, including arrays and record fields. Weak
and strict callers each run twice after offline Composer installation and
relocation, with producer sources and archive handoffs removed. A separate
in-memory probe injects conversion failures and checks scratch/output cleanup;
both public callers then repeat against the unchanged installation. The suite
checks malformed values, native flags, inactive payloads, copy limits and
recovery. CI retains `build/compounds/php-native.json`. The
[native compound record](../evidence/php-native-compounds-20260920.md) records
the exact installed packages.

PHP-Wasm runs the same compound signature catalog through its 32-bit Zend adapter:

```sh
LEAN_BRIDGE_PHP_WASM_COMPOUND_TEST=1 node --test \
  tests/php-wasm-compounds.test.mjs \
  tests/php-wasm-compound-contract.test.mjs \
  tests/php-wasm-compound-zend.test.mjs
```

Both source paths install npm and Composer archives offline with empty caches,
repeat locked installs, relocate the application, and remove producer sources
and the handoff before execution. Node and Chromium repeat weak/strict callers
with startup and lazy loading. Every run preserves the installed-file inventory.
Separate synthetic Zend providers check allocation failure, malformed wire
values, inactive payloads, native flags and bailout cleanup. These probes do not
replace the compiled Lean acceptance library. CI retains
`build/compounds/php-wasm.json` and `build/compounds/php-wasm-zend-faults.json`.
See the [PHP-Wasm compound record](../evidence/php-wasm-compounds-20260920.md).

The generic Zend adapter has a separate real PHP-Wasm check:

```sh
bash scripts/bootstrap-php-wasm-ci.sh
LEAN_BRIDGE_PHP_WASM_ZEND_TEST=1 node --test tests/php-copied-zend.test.mjs
```

This compiles two synthetic C providers and executes their generated APIs inside 32-bit PHP-Wasm. It checks exact integer conversion, nested copied values, relocated builds, allocation failures and Zend bailout cleanup. It does not run Lean or establish installed ordinary PHP-Wasm support. The [Zend boundary record](../evidence/php-wasm-copied-zend-20260915.md) lists the tested scope and remaining compiler/package integration.

To compile ordinary Lean implementations for that boundary, prepare the separate PHP-Wasm runtime profile:

```sh
bash scripts/bootstrap-toolchains.sh
bash scripts/bootstrap-php-wasm-ci.sh
export LEAN_WASM_EMSDK="$PWD/.toolchains/emsdk-php-wasm"
export LEAN_WASM_RUNTIME_PROFILE=browser
export LEAN_WASM_RUNTIME_VARIANT=php-wasm-3.1.68
export LEAN_WASM_ARTIFACT_TARGET=php-wasm-emscripten-3.1.68
bash scripts/build-lean-runtime.sh
npx playwright install --with-deps chromium
LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1 \
LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1 \
  node --test --test-reporter=spec tests/php-wasm-ordinary.test.mjs
```

Willow and Aspen each compile 46 ordinary Lean exports twice through a tarball-installed CLI's public `build --target php-wasm` command. The suite compares relocated builds and deterministic npm/Composer archives, installs offline, moves the installed application, and executes actual Lean without compiler commands on `PATH`. It checks embedded PHP files, Composer autoloading and Vite-built asset URLs in Node-hosted PHP-Wasm, each with startup and lazy loading. A seventh arrangement mixes the two loading modes. Each route checks exact values, strict validation, output-budget recovery, independent results despite shared Lean module names, repeated requests, duplicate registration and one runtime initialization. The composed Node check also passes a returned closure between packages and checks nested exception identity and recovery. Separate installed checks cover disabled `dl()`, missing registration, missing extensions and missing runtimes, including restoration of the application's PHP error handler. The [first-call record](../evidence/php-wasm-lazy-20260915.md) records the earlier copied-value checks; the [callable record](../evidence/php-wasm-callables-20260919.md) adds the two callable exports. Earlier [compiler](../evidence/php-wasm-ordinary-20260915.md), [installed package](../evidence/php-wasm-packages-20260915.md) and [public CLI](../evidence/php-wasm-cli-20260915.md) records retain each milestone's evidence.

Run the PHP-Wasm primitive callable acceptance with the same author toolchain and Chromium:

```sh
LEAN_BRIDGE_PHP_WASM_CALLABLE_TEST=1 \
  node --test tests/php-wasm-callables.test.mjs tests/php-wasm-callable-contract.test.mjs
```

The 63-export library covers nineteen primitives and sixteen-argument functions on ordinary-source and independently reviewed paths. Each path runs twelve installed configurations: weak/strict callers, startup/lazy loading, embedded/Composer APIs in Node, and bundled APIs in Chromium. The tests cover exact wasm32 values, original exceptions, expired borrows, reentry, closure disposal, aliases, registry capacity, warmed memory use, callback `exit()` cleanup and subsequent-call recovery. Production-state tests check deferred close, the Fiber guard and token exhaustion. The pinned PHP-Wasm host cannot start Fibers; installed Fiber execution is not claimed. CI retains `build/callables/php-wasm.json`. The [acceptance record](../evidence/php-wasm-callables-20260919.md) binds the results to installed archives. Compiler inputs prepared before this milestone must be rebuilt to include the callback registry.

Each of the seven arrangements runs with both weak and strict PHP callers, for fourteen installed Node routes. The boundary vectors exercise all sixteen primitives as scalar inputs/results, array elements and nested record fields. Comparisons check exact integer and byte contents, float bits including signed zero, and NaN classification. Invalid types, integer overflow and malformed UTF-8 must fail consistently in both caller modes, followed by a successful call. The [primitive boundary record](../evidence/php-wasm-primitive-boundaries-20260918.md) records the results and archive identities.

With `LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1`, the same installed packages execute in Chromium under a nested application URL with external requests blocked. The browser checks all 88 exports and 20 repeated requests in both modes. It requires zero Lean library requests during lazy startup, PHP autoload and invalid-input validation, then one fetch for each needed library. Timers must run during deliberately delayed cold downloads. Disabled loading and corrupt runtime bytes must produce explicit errors without another lazy attempt. The suite then builds and executes the exact consumer guide's HTML, Vite config and JavaScript. Use `CHROMIUM_PATH` for an existing browser binary; otherwise the helper uses `/usr/bin/chromium` when present, then Playwright's installed Chromium. CI requires the browser check. The original [browser record](../evidence/php-wasm-browser-20260915.md) and subsequent [first-call record](../evidence/php-wasm-lazy-20260915.md) document the executed scope.

Chromium also runs both caller modes, for four installed browser routes across startup and lazy loading. The public guide and loading-failure checks run separately.

For PHP-Wasm combined with JavaScript and native PHP, also prepare the ordinary JavaScript engine/runtime and native PHP author tools. Reset the shell to the default JavaScript Emscripten profile before this check; the PHP compiler selects its separate SDK explicitly:

```sh
unset LEAN_WASM_EMSDK LEAN_WASM_RUNTIME_VARIANT LEAN_WASM_ARTIFACT_TARGET
source scripts/env.sh
nix build .#universal-core-artifacts --out-link build/php-multi-runtime
nix build .#component-build-engine --out-link build/php-multi-engine
LEAN_BRIDGE_LAKE_ENGINE=build/php-multi-engine/bin/lean-bridge-component-engine \
LEAN_BRIDGE_LAKE_RUNTIME_ROOT=build/php-multi-runtime/lazy \
LEAN_BRIDGE_PHP_MULTI_PROFILE_TEST=1 \
  node --test --test-reporter=spec tests/php-wasm-multi-profile.test.mjs
```

The suite executes all three profiles and both PHP-Wasm pairs, counts one compilation per ABI, compares relocated releases with reversed target order, and hides source/build directories before installed execution. The PHP consumer CI gate requires both ordinary suites.

Nix builds the PHP 8.2 NTS Alpha package for x86-64 Linux:

```sh
nix --extra-experimental-features 'nix-command flakes' \
  build .#php-native-package --out-link build/consumer-php-native
export LEAN_ALPHA_PHP_PACKAGE=$(readlink -f build/consumer-php-native)
```

The output includes `lib/php/lean_alpha.so`, the shared Lean runtime, and `share/php/component/composer.json`. The [native PHP guide](../php.md#native-php) installs those Composer sources and runs the application. The [native release record](../evidence/native-php-release-package.md) records the producer's pinned toolchain. The installed consumer check below uses the matching PHP and Composer from Nix.

## Python packages

### Ordinary-source Python packages

Use the pinned Lean compiler, a native C compiler and Python 3.11 or newer with pip and venv. Set `LEAN_BRIDGE_PYTHON` to an absolute interpreter path if it is not available as `python3`:

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_PYTHON_TEST=1 \
  node --test --test-reporter=spec tests/native-python.test.mjs
```

Iris and Lotus each expose 42 functions and reproduce their wheels from relocated source trees. The suite hides those trees, installs original wheels with pip offline, and runs typed APIs with no Lean or C compiler available. It checks primitives, nested arrays and records, rejected inputs, allocation-failure cleanup, concurrent calls, tampering, post-fork rejection and two installed packages sharing a runtime. Uninstalling one distribution must leave the other usable. See the [Python acceptance record](../evidence/native-python-20260915.md).

## Shared real-Lean type corpus

The shared corpus adds differential tests: a fresh Lean run computes expected results, then an installed consumer package must return those results. Run its fast report checks without a compiler:

```sh
npm run test:type-corpus
```

Python needs the same prerequisites as the ordinary-source suite above. Ruby needs MRI Ruby 3.3 with RubyGems. Perl needs a 64-bit Perl 5.36 or newer with matching headers, MakeMaker, make and tar. All three adapters run on Linux x86-64 and need the pinned Lean compiler, a native C compiler, Git and at least 3 GiB of free scratch space. Run an adapter separately:

```sh
source scripts/env.sh
npm run test:type-corpus:python
npm run test:type-corpus:ruby
npm run test:type-corpus:perl
```

To build Python and Ruby together, or all eleven native-runtime adapters including C, C++, Rust, .NET, Java, Kotlin, native PHP and WIT/WASI, and compare the consumers against the same Lean run:

```sh
npm run test:type-corpus:native
npm run test:type-corpus:all-native
```

Set `LEAN_BRIDGE_PYTHON`, `LEAN_BRIDGE_RUBY`, `LEAN_BRIDGE_GEM` and `LEAN_BRIDGE_CORPUS_PERL` to absolute executable paths when selecting alternate host installations. The Perl build compiles XS only for that interpreter's ABI. Its consumer installs both runtime and component archives in `prebuilt-only` mode and checks the selected XS hashes and ABI.

Rust runs on Linux x86-64 and needs Rust/Cargo 1.90 or newer, a system linker, tar, gzip and 3 GiB of free scratch space. The author build also needs the pinned Lean and native C toolchains. Install the pinned Rust toolchain and run its corpus:

```sh
bash scripts/bootstrap-rust-ci.sh
source scripts/env.sh
npm run test:type-corpus:rust
```

`LEAN_BRIDGE_RUSTC` and `LEAN_BRIDGE_CARGO` select absolute tool paths; the corpus defaults to `.toolchains/rust-1.90.0/bin/`. The author build resolves the crate's locked Cargo dependencies. The consumer receives those dependencies as a hashed vendor archive and builds offline with an empty Cargo home. Only Rust compilation and linking are allowed during installation. The harness removes the entire consumer build tree, then executes the relocated binary twice with compiler and Cargo paths disabled. Normal exit must remove the runtime loader's temporary assets and registry files.

C and C++ run on Linux x86-64 and need GCC/G++ 12 or newer at `/usr/bin/cc` and `/usr/bin/c++`, CMake 3.20+, make, pkg-config, tar, gzip and 3 GiB of free scratch space. The author build needs the pinned Lean and native toolchains. Run either adapter or both together:

```sh
source scripts/env.sh
npm run test:type-corpus:c
npm run test:type-corpus:cpp
npm run test:type-corpus:c-family
```

Each C/C++ installation builds two independent consumers: one uses the prepared pkg-config file, the other uses its CMake imported target. Only the downstream caller is compiled. The harness moves both executables and their packaged shared libraries, deletes the installed package and consumer build tree, then runs each executable twice without compiler paths or runtime overrides. All packaged libraries must resolve inside the moved deployment.

.NET runs on Linux x86-64 and needs the .NET 8 SDK, the pinned Lean and native C toolchains, Git and 3 GiB of free scratch space. CI uses SDK 8.0.424. Select an absolute `dotnet` path and run:

```sh
export LEAN_BRIDGE_DOTNET=/absolute/path/to/dotnet
source scripts/env.sh
npm run test:type-corpus:dotnet
```

The local default is `.toolchains/dotnet/dotnet`. Each C# consumer restores only its prepared NuGet archive from a private feed, with empty package and CLI caches, a source mapping and an exact version. A second restore uses the lock file. The harness compiles the caller against the public assembly, then removes the entire installation and consumer build tree. It runs the relocated assembly twice with a copied .NET runtime containing no SDK, Roslyn or reference assemblies. Packaged native libraries must load from that deployment.

Java and Kotlin run on Linux x86-64 and need JDK 22.0.2, Maven 3.8 or 3.9, Kotlin 2.2.0, unzip, tar and gzip, plus the pinned Lean and native C toolchains. Select tools from the same JDK, then run either adapter or both:

```sh
export LEAN_BRIDGE_JAVA=/absolute/path/to/jdk-22/bin/java
export LEAN_BRIDGE_JAVAC=/absolute/path/to/jdk-22/bin/javac
export LEAN_BRIDGE_MAVEN=/absolute/path/to/maven/bin/mvn
export LEAN_BRIDGE_KOTLINC=/absolute/path/to/kotlinc/bin/kotlinc
source scripts/env.sh
npm run test:type-corpus:java
npm run test:type-corpus:kotlin
npm run test:type-corpus:jvm
```

Local defaults are `.toolchains/jdk22/`, `.toolchains/apache-maven-3.9.11/` and `.toolchains/kotlin-2.2.0/kotlinc/`. Java alone does not need Kotlin. The author stage downloads pinned Maven install/dependency plugins and records their dependency files in a hashed archive. Each downstream consumer starts with an empty Maven repository and user home, imports that build-tool archive, and installs the exact prepared JAR and POM offline. Dependency resolution must return only that package's JAR.

After compiling the caller, the harness removes its sources, Maven installation tree, repository and cache. It moves the original package JAR and caller classes into a separate deployment and runs them twice with a `jlink` image containing only `java.base`. No Maven, Java compiler or Kotlin compiler is available in that runtime image. Kotlin includes its separately hashed standard-library JAR. The original package JAR retains its shipped source provenance; the harness does not strip or repack it. Native assets must load from the package, match their recorded hashes, and be removed from the private temporary directory on normal exit.

Native PHP runs on Linux x86-64 with non-threaded PHP 8.2 or newer (below PHP 9), Composer 2, unzip and the pinned Lean/native author tools. PHP needs FFI; the selected Composer interpreter also needs ctype, iconv, mbstring, Phar and ZIP. Select absolute executable paths, then run:

```sh
export LEAN_BRIDGE_PHP=/usr/bin/php
export LEAN_BRIDGE_COMPOSER=/usr/bin/composer
source scripts/env.sh
npm run test:type-corpus:php-native
```

Each Composer consumer starts with empty private home/cache directories, disables Packagist, network access, plugins and scripts, and installs only the original prepared ZIP. A second install checks the lock file and unchanged installed bytes. The harness moves the installed application, removes the installation tree and executes separate weak and strict PHP caller files twice each. Public reflection checks function signatures, PHPDoc types and readonly records against the independent corpus catalog. Both caller modes compare exact values with fresh Lean results and check rejected inputs, copied records and recovery. PHP runs with INI files disabled, explicitly selected FFI, and no compiler or Composer commands on PATH. The installed PHP API and its shipped provenance remain in the deployment.

The report records the actual Composer implementation files, interpreter/extensions, included PHP files, loaded native libraries and package receipts. It is written to `build/type-corpus/php-native.json`. The [native PHP corpus record](../evidence/type-corpus-php-native-20260917.md) lists the executed scope and artifact identities.

WIT/WASI needs Linux x86-64, GCC 12 or newer at `/usr/bin/cc`, pkg-config, tar, gzip, the pinned Lean toolchain, wasm-tools 1.245.1 and the official Wasmtime 42.0.1 C API. The author build checks the C API's complete file inventory. Select its root and run:

```sh
export LEAN_BRIDGE_WASMTIME_C_API=/absolute/path/to/wasmtime-v42.0.1-x86_64-linux-c-api
source scripts/env.sh
npm run test:type-corpus:wit-wasi
```

The local default is `.toolchains/wasmtime42`. `LEAN_BRIDGE_WASM_TOOLS` selects the wasm-tools executable; the installed-consumer check otherwise uses `.toolchains/wasm-tools/bin/wasm-tools`. CI obtains the C API from `nix build .#wasmtime-c-api`. Consumers receive both Wasmtime and Lean libraries in their prepared archives.

Each WIT consumer compiles a C11 caller against the installed public Wasmtime header and pkg-config file. Parsed WIT and binary component interfaces must match the independent catalog, including nested record fields. The harness removes author, oracle and consumer build trees before running the relocated executable twice without compilers or runtime overrides. The process must load the exact packaged native libraries.

Wasmtime's fixed-width C fields cannot represent out-of-range integers, so those literals must fail compilation with range diagnostics. Separate runtime checks reject incorrect tags, non-canonical exact integers, invalid UTF-8, malformed records and invalid calls. Conversion limits and a native-budget trap must leave the output slot unchanged; subsequent calls must match fresh Lean results. Copied records must remain independent of inputs and other results, and survive closing the session.

This profile executes a Component Model component with its packaged native Lean host. It does not compile the algorithm into a standalone WASI command. Its report is `build/type-corpus/wit-wasi.json`. The [WIT/WASI corpus record](../evidence/type-corpus-wit-wasi-20260917.md) documents the executed scope.

PHP-Wasm runs the same libraries in the 32-bit PHP 8.4.1 embedded host. Prepare the [PHP-Wasm author toolchain](author-toolchain.md#php-wasm), the pinned `php-wasm` 0.1.0 host and Chromium, then run:

```sh
source scripts/env.sh
npm run test:type-corpus:php-wasm
```

`LEAN_BRIDGE_PHP_WASM_HOST` selects the host package directory; its default is `build/php-wasm-host/node_modules/php-wasm`. `CHROMIUM_PATH` selects a browser executable; otherwise the harness uses the local Chromium binary or Playwright's Chromium. Composer 2, unzip and the native PHP extensions listed above are needed to install the companion PHP package, but FFI is not used by the PHP-Wasm interpreter. Native PHP runs Composer with INI disabled; its target platform is set to PHP 8.4.1. The actual calls execute in PHP-Wasm, not that native interpreter.

The harness builds each library twice, verifies the npm runtime/component and matching Composer archives, and removes the author trees. Offline npm installs include a locally repacked copy of the pinned host, with no external symlink. Composer installs the prepared API ZIP. Empty caches, locked repeat installs and complete file inventories check the installed dependency closure. All hosts use a relocated deployment; Node runs with no Lean or C compiler on PATH.

Each library runs 12 combinations: Node with descriptor-mounted or Composer-loaded PHP, plus a bundled Chromium page; each uses startup or lazy loading and weak or strict lexical PHP callers. Every combination runs twice in a fresh host. Chromium serves a nested application URL with external requests blocked and records the exact bytes served. Lazy hosts must fetch no Lean libraries during autoload or invalid-input checks, then load the runtime and component once on the first valid call.

On this 32-bit host, `UInt32` and `Int64` use `BigInteger`, alongside `Nat`, `Int` and `UInt64`. The independent signature checks enforce those mappings. Out-of-range native `Int32` literals become PHP floats and must be rejected as wrong types, without truncation. Both caller modes compare the full value corpus with fresh Lean results and test copied values, invalid inputs and recovery. The report is `build/type-corpus/php-wasm.json`; Node/browser routes and supplemental rejections have separate counts. The [PHP-Wasm corpus record](../evidence/type-corpus-php-wasm-20260917.md) lists the executed scope and archive identities.

For Node JavaScript and TypeScript, prepare the pinned Lean/Emscripten toolchain and shared WASM runtime using the [author toolchain setup](author-toolchain.md), then run:

```sh
source scripts/env.sh
npm run test:type-corpus:node
```

Node needs version 22 or newer, npm, the repository's TypeScript compiler, Git and 3 GiB of free scratch space. The default prepared runtime is `build/lean-link-spike/lazy`; `LEAN_BRIDGE_LAKE_RUNTIME_ROOT` selects another runtime directory. `LEAN_BRIDGE_LAKE_ENGINE` selects the pinned external component engine used in CI. The Lean oracle still needs the local pinned compiler.

Browser JavaScript, React and dedicated Web Workers consume the same prepared npm releases. Install Playwright's engines and OS libraries, then run the browser profiles or all five npm profiles together:

```sh
npx playwright install --with-deps chromium firefox webkit
npm run test:type-corpus:browser
npm run test:type-corpus:npm
```

All three engines run by default. For a focused local check, set `LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium`, `firefox`, `webkit` or a comma-separated subset. Missing engines and invalid selections fail; the harness never skips a requested browser. CI requires all three. `PLAYWRIGHT_BROWSERS_PATH` selects an alternate Playwright installation.

`Shop.Pricing` and `Telemetry.Readings` use different APIs, record layouts and calculations. Each fixture has a local Lake dependency and a pinned Git dependency created in the test's offline cache. The harness checks the compiler's function signatures and nested record types against an independent catalog, then tests the installed transport. It compiles the same source files for the Lean oracle and the packages, builds each archive from two relocated workspaces, and compares archive hashes. It deletes the author workspaces and unpacked releases before installing each wheel, gem, CPAN, Cargo, C/C++, NuGet, Maven, Composer, WIT or npm archive offline. Consumers call public exports with compiler paths disabled.

After validating a library's observations and rechecking its receipts, the harness removes that transport's consumer directory before starting another library. Failure hooks also clean incomplete runs. This keeps completed installations from consuming the next build's scratch-space allowance.

Native builds discard the duplicate release immediately after comparing archive bytes, binding IR and declarations. Only the first verified release supplies the consumer handoff. This avoids retaining two full package sets while copying archives and preparing offline build dependencies.

The catalog contains 124 cases across both libraries. Python, Ruby, Perl and native PHP execute all of them: all 16 primitive parameter/result types, nested arrays, copied records, invalid inputs and recovery after rejection. PHP repeats the catalog in weak and strict caller modes. Rust executes 84 positive cases and records 40 invalid inputs as compiler rejections. Each npm corpus package selects scalar exports, executes 112 cases and leaves 12 unselected array/record cases as gaps for that release. Its negative-build copy adds an unsupported `Sum UInt32 UInt32` export; the original oracle modules are unchanged. The separate [npm array](../evidence/npm-arrays-20260920.md), [record](../evidence/npm-records-20260920.md) and [compound suites](../evidence/npm-compounds-20260920.md) exercise nested copied values and all nineteen primitives on both source paths in Node, strict TypeScript and three browser engines, including React and workers. Native and PHP-Wasm corpus negative copies also use `Sum UInt32 UInt32`; their original oracle modules remain unchanged. The [C/C++ compound suite](../evidence/native-compounds-20260920.md) covers options, results and products separately. The [npm List suite](../evidence/npm-lists-20260920.md) covers List parameters, results and fields on both source paths in the same five npm profiles. The [C/C++ List suite](../evidence/native-lists-20260920.md) adds installed native spans and vectors, nested payloads, budget recovery and allocation-failure cleanup. Run it with `LEAN_BRIDGE_NATIVE_LIST_TEST=1 node --test tests/native-lists.test.mjs`; CI retains `build/lists/native.json`.

The [C/C++ collection suite](../evidence/native-collections-20260921.md) checks
all nineteen primitives, seven records and 24 fixed Array levels on both
source paths:

```sh
LEAN_BRIDGE_NATIVE_COLLECTION_TEST=1 node --test tests/native-collections.test.mjs
node --test tests/native-collection-contract.test.mjs tests/native-collection-evidence.test.mjs
```

CI requires `build/collections/native.json`. Original archives install offline
after author removal, relocate and execute twice without compilers. Separate
native and C/GMP sanitizer probes test allocation failures and partial cleanup;
the installed C++ caller also fails host allocation checkpoints. Startup and
initialized-fixture sanitizer reports remain separate, and repeated
initialization must not grow the report.

Run the npm compound suite against the prepared shared runtime:

```sh
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit \
  node --test tests/component-compounds.test.mjs
  node --test tests/component-lists.test.mjs
node --test tests/component-compound-contract.test.mjs
```

The installed checks preserve none/some Unit, nested options, asymmetric result
branches, product nesting and mixtures with arrays and records. They also test
recordless packages, malformed inputs, cleanup after partial output, and a
compile-time UInt64 constant that detects missing wasm32 static-layout flags.
CI retains `build/compounds/npm/` and `build/compounds/recordless/`.

Run the installed Python compound checks on both source paths:

```sh
LEAN_BRIDGE_PYTHON_COMPOUND_TEST=1 node --test tests/python-compounds.test.mjs
node --test tests/python-compound-contract.test.mjs
```

The [Python compound suite](../evidence/python-compounds-20260920.md) checks all
nineteen primitives, explicit `Some`/`Ok`/`Err` branches, nested products and copied
arrays/records. It removes producer files before offline wheel installation and
tests malformed values, conversion limits and cleanup after injected failures.
CI retains `build/compounds/python.json`.

Run the installed Python List checks on both source paths:

```sh
python3 -m pip download --no-cache-dir --only-binary=:all: --no-deps \
  --dest build/python-typing-wheels/4.16.0 typing_extensions==4.16.0
LEAN_BRIDGE_PYTHON_LIST_TEST=1 node --test tests/python-lists.test.mjs
node --test tests/python-list-contract.test.mjs
```

The [Python List suite](../evidence/python-lists-20260920.md) installs prepared
wheels after removing producer files. It checks all nineteen primitive elements,
nested arrays/Lists/options/results/products, copied record fields, exact public
annotations, conversion failures, allocation limits and concurrent calls.
CI retains `build/lists/python.json`.

Run the Python array/record collection suite with CPython 3.11 and 3.12 installed.
Set `LEAN_BRIDGE_COLLECTION_PYTHONS` to a JSON array containing their absolute
executable paths, in that order. Without the override, the suite uses
`.toolchains/python311/bin/python3.11` and `.toolchains/python312/bin/python3.12`.
Prepare the isolated checker and both offline dependency versions:

```sh
python3 -m venv build/python-collection-typecheck
build/python-collection-typecheck/bin/python -m pip install --no-cache-dir \
  mypy==2.3.1 typing_extensions==4.16.0 mypy_extensions==1.1.0 \
  pathspec==1.1.1 librt==0.15.0 ast-serialize==0.11.2
python3 -m pip download --no-cache-dir --only-binary=:all: --no-deps \
  --dest build/python-typing-wheels/4.6.0 typing_extensions==4.6.0
python3 -m pip download --no-cache-dir --only-binary=:all: --no-deps \
  --dest build/python-typing-wheels/4.16.0 typing_extensions==4.16.0
LEAN_BRIDGE_PYTHON_WHEEL_INSTALL_TEST=1 node --test tests/python-wheel-install.test.mjs
LEAN_BRIDGE_PYTHON_COLLECTION_TEST=1 node --test \
  tests/python-collections.test.mjs tests/python-collection-contract.test.mjs
node --test tests/python-collection-evidence.test.mjs
```

The installer checks each dependency wheel's pinned SHA-256, then lets pip resolve
the original component wheel with `--no-index --find-links`. Python 3.11 runs with
both the minimum and current backport; Python 3.12 runs without that dependency.
The separate wheel-install test uses a metadata-only fixture to check dependency
resolution, runtime annotations and strict positive/negative typing of installed
stubs. It does not count as compiled Lean evidence.
Both source paths exercise all 19 primitive elements, seven record types and 24
fixed array levels. The suite removes producer files, relocates installations,
checks public calls and precise runtime annotations, and runs strict positive
and negative typing fixtures. Separate in-memory probes inject failures without
editing installed files. Each mypy process has a 30-second deadline and 1 GiB
address-space limit. The suite also builds the publisher's Parcels example and
executes the consumer's arrays-and-records example from its relocated original
wheel. CI retains `build/collections/python.json` and
`build/collections/python-docs.json`.

The [installed collection record](../evidence/python-collections-20260922.md)
binds both source paths, all three runtime/dependency configurations, unchanged
installed files and an independent rebuild to their public callers.

Mypy 1.17.1 remains pinned for the earlier alias and variant regressions. Its deep
union expansion is unsuitable for this collection fixture; keep the new checker
in its separate environment.

Run the installed Rust compound checks on both source paths:

```sh
LEAN_BRIDGE_RUST_COMPOUND_TEST=1 node --test tests/rust-compounds.test.mjs
node --test tests/rust-compound-contract.test.mjs
```

The [Rust compound suite](../evidence/rust-compounds-20260920.md) checks all
nineteen primitive payloads, nested containers, independent owned results and
threaded calls. Each path also compiles eleven invalid consumer programs,
injects allocation failures and panics, and runs the relocated executable after
removing the crate and dependency sources. CI retains `build/compounds/rust.json`.

Run the installed Rust List checks on both source paths:

```sh
LEAN_BRIDGE_RUST_LIST_TEST=1 node --test tests/rust-lists.test.mjs
node --test tests/rust-list-contract.test.mjs
```

The [Rust List suite](../evidence/rust-lists-20260920.md) checks all nineteen
primitive elements, nested copied values, slice input types and owned results.
It compiles invalid consumers, injects conversion errors and panics, and checks
malformed private output layouts. The public consumer reruns after removal of
crate and dependency sources. CI retains `build/lists/rust.json`.

Run the Rust array/record checks with the pinned Rust toolchain:

```sh
LEAN_BRIDGE_RUST_CONVERSION_TEST=1 node --test tests/rust-collection-conversions.test.mjs
LEAN_BRIDGE_RUST_COLLECTION_TEST=1 node --test tests/rust-collections.test.mjs
node --test tests/rust-collection-contract.test.mjs tests/rust-collection-evidence.test.mjs
```

The conversion preflight needs a populated Cargo cache and runs offline. It
compiles the independent public caller, rejects fifteen invalid programs and
executes generated host conversions for nineteen primitive array shapes, seven
records and 24 fixed array levels. It also tests allocation failures, unwinding,
malformed buffers and copy limits. It compiles the native fault probe but does
not execute it or load Lean. Its report, `build/collections/rust-conversions.json`,
does not count as installed-package evidence.

The installed suite builds original crates on both source paths. Consumers
install the archives and checksummed dependency closure offline with an empty
Cargo home. They compile Rust without Lean or C compilation, execute the public
caller, then repeat from a relocated executable after all sources are removed.
Private fault tests run in a separate instrumented copy; the original installed
files and dependencies must remain unchanged. CI retains the preflight report
and `build/collections/rust.json` separately.

The [installed collection record](../evidence/rust-collections-20260922.md)
binds public callers, unchanged original crates, dependencies, failure probes
and an independent rebuild. The suite also compiles the actual consumer
documentation example and runs it after source removal, with compiler access disabled.

Run the installed .NET compound checks on both source paths:

```sh
LEAN_BRIDGE_DOTNET_COMPOUND_TEST=1 node --test tests/dotnet-compounds.test.mjs
node --test tests/dotnet-compound-contract.test.mjs
```

The [.NET compound suite](../evidence/dotnet-compounds-20260920.md) installs
prepared NuGet assemblies offline, compiles invalid consumers and reruns the
relocated application with only the .NET runtime. A separate instrumented copy
of the compiler-produced C# projection tests conversion failures and malformed
native flags without changing the installed assembly. CI retains
`build/compounds/dotnet.json`.

Run the .NET array/record checks:

```sh
LEAN_BRIDGE_DOTNET_CONVERSION_TEST=1 node --test tests/dotnet-collection-conversions.test.mjs
LEAN_BRIDGE_DOTNET_COLLECTION_TEST=1 node --test tests/dotnet-collections.test.mjs
node --test tests/dotnet-collection-contract.test.mjs
```

The conversion preflight uses the .NET 8 SDK and an empty NuGet source list. It
compiles the independent public caller, rejects sixteen invalid programs and
executes unchanged generated converters for nineteen primitive array shapes,
seven records and 24 fixed array levels. It checks independent copies, partial
invalid inputs, copy limits, null and misaligned result buffers, Unicode,
canonical integer magnitudes, boolean bytes and unit markers. Valid empty
buffers do not read their data pointer. A separate instrumented copy checks
cleanup at every conversion and allocation checkpoint. The preflight compiles
the native-result failure probe but does not execute it or load Lean. Its report,
`build/collections/dotnet-conversions.json`, does not count as installed-package
coverage.

The installed suite builds original NuGet archives on both source paths.
Consumers install from a local-only feed with an empty package cache, compile
the public caller and reject the invalid programs against the installed
assembly. They execute all 35 exports, copied-value checks and threaded calls.
Failure probes run in a separate source copy; the installed package must remain
unchanged. The suite then removes package and consumer sources and feeds. It
reruns the relocated application twice with a runtime-only deployment that
contains no SDK. It also compiles the consumer guide's Array/record example
against the original installed assembly and runs it after source removal. The
[installed collection record](../evidence/dotnet-collections-20260922.md) binds
the repeated build, consumer and failure checks. CI retains
`build/collections/dotnet.json` separately from the preflight report.

Run generated .NET value equality checks without a native library:

```sh
LEAN_BRIDGE_DOTNET_EQUALITY_TEST=1 node --test tests/dotnet-value-equality.test.mjs
```

This compiles unchanged generated C# sources for collections, compounds, Lists,
aliases and variants. The independent caller checks nested equality and hashes,
dictionary/set lookup, constructor identity, absent and active branches, empty
arrays and mutation. It also checks structural comparison of native C# arrays
and tuples. CI retains `build/equality/dotnet.json` as host-only evidence, not
installed-package or Lean-execution coverage.

Run the copied .NET List checks on both source paths:

```sh
LEAN_BRIDGE_DOTNET_LIST_TEST=1 node --test tests/dotnet-lists.test.mjs
node --test tests/dotnet-list-contract.test.mjs
```

The [.NET List suite](../evidence/dotnet-lists-20260920.md) checks typed arrays
and nested values, rejects twelve invalid C# consumers, injects conversion
failures, and checks malformed native sequence buffers. It reruns from a
deployment with no SDK, source package or feed. CI retains
`build/lists/dotnet.json`.

Run the installed Java and Kotlin compound checks with JDK 22, Kotlin 2.2 and
Maven 3.9.11, using the same tool paths as the JVM corpus:

```sh
LEAN_BRIDGE_JVM_COMPOUND_TEST=1 node --test tests/jvm-compounds.test.mjs
node --test tests/jvm-compound-contract.test.mjs
```

The [JVM compound suite](../evidence/jvm-compounds-20260920.md) builds a prepared
Maven package on each source path. Independent Java and Kotlin consumers install
it offline, check boxed generic signatures and compile invalid callers. Each
consumer runs twice in a relocated deployment with only a `java.base` runtime.
A separate instrumented adapter checks scoped cleanup and malformed output;
the installed release JAR stays unchanged. CI retains `build/compounds/jvm.json`.

Run the installed Java and Kotlin List checks with the same tools:

```sh
LEAN_BRIDGE_JVM_LIST_TEST=1 node --test tests/jvm-lists.test.mjs
node --test tests/jvm-list-contract.test.mjs
```

The [JVM List suite](../evidence/jvm-lists-20260920.md) checks primitive and
reference arrays, nested copied values, compiler rejections and copy budgets.
Both languages install the same prepared JAR offline on each source path and
run twice with only a `java.base` runtime. Separate probes inject conversion
and allocation failures and reject malformed native sequence buffers. CI
retains `build/lists/jvm.json`.

Run the installed Ruby compound checks with MRI Ruby 3.3 and RubyGems:

```sh
LEAN_BRIDGE_RUBY_COMPOUND_TEST=1 node --test tests/ruby-compounds.test.mjs
node --test tests/ruby-compound-contract.test.mjs
```

Set `LEAN_BRIDGE_RUBY` and `LEAN_BRIDGE_GEM` to the selected executables. The
[Ruby suite](../evidence/ruby-compounds-20260920.md) builds all nineteen primitives
inside options, results and products, plus mixed records and deep nesting, on
both source paths. It installs each gem offline, removes producer inputs and the
archive handoff, relocates the installation, and executes an independent public
consumer twice without compilers. A separate process injects conversion failures
and checks cleanup without changing installed files. Ruby source files remain
part of the installed package. CI retains `build/compounds/ruby.json`.

Run the copied Ruby List checks with the same interpreter:

```sh
LEAN_BRIDGE_RUBY_LIST_TEST=1 node --test tests/ruby-lists.test.mjs
node --test tests/ruby-list-contract.test.mjs
```

The [Ruby List suite](../evidence/ruby-lists-20260921.md) checks all nineteen
primitive elements, nested copied values, invalid containers and payloads,
copy budgets, independent results and GC compaction. Both source paths install
and relocate a prepared gem offline, remove producer inputs and the handoff,
and repeat the public checks. A separate process injects conversion failures
and probes malformed native sequence buffers. CI retains `build/lists/ruby.json`.

Run the installed Perl compound checks with a selected supported interpreter:

```sh
export LEAN_BRIDGE_CORPUS_PERL="$PWD/.toolchains/perl/5.38.2-threaded/bin/perl"
LEAN_BRIDGE_PERL_COMPOUND_TEST=1 node --test tests/perl-compounds.test.mjs
node --test tests/perl-compound-contract.test.mjs
```

Set `LEAN_BRIDGE_PERLS` to a JSON array of absolute interpreter paths to test
several ABIs against one Lean build. The [Perl suite](../evidence/perl-compounds-20260920.md)
checks ordinary and reviewed packages, all nineteen primitive payloads, mixed
records, deep options, malformed values, copy independence and conversion limits.
It installs the runtime and component offline in `prebuilt-only` mode, relocates
the installation, removes the producer and archive handoff, and runs the public
consumer twice without compilers. A separately compiled test-only XS copy injects
conversion failures and exercises cleanup. Installed files remain unchanged.
CI runs this suite for all four pinned ABIs and retains `build/compounds/perl.json`.

Run the copied Perl List checks with the same interpreter selection:

```sh
LEAN_BRIDGE_PERL_LIST_TEST=1 node --test tests/perl-lists.test.mjs
node --test tests/perl-list-contract.test.mjs
```

The [Perl List suite](../evidence/perl-lists-20260921.md) checks both source paths,
all nineteen primitive elements, nested Lists and arrays, copied record fields,
24-level Lists, invalid values and copy-limit recovery. It installs and relocates
both CPAN archives, removes producer sources and the handoff, and repeats public
execution without compilers. Separate test-only XS injects conversion failures,
checks partial-input cleanup, preserves host exceptions and tests input mutation
during element conversion. Installed files remain unchanged. CI runs all four
pinned ABIs and retains `build/lists/perl.json`.

Run the installed native PHP List checks with PHP 8.2+ NTS CLI, FFI and Composer:

```sh
LEAN_BRIDGE_PHP_LIST_TEST=1 node --test tests/php-lists.test.mjs
node --test tests/php-list-contract.test.mjs tests/php-list-evidence.test.mjs
```

The [native PHP List suite](../evidence/php-native-lists-20260921.md) checks
both source paths and weak/strict callers. It installs the Composer archive
offline, removes producer inputs and the handoff, then repeats the public
consumer from a relocated installation without compilers. Separate in-memory
instrumentation injects conversion failures and tests malformed native output
buffers without changing installed files. CI retains `build/lists/php-native.json`.

Run the PHP-Wasm List checks with the [PHP-Wasm author toolchain](author-toolchain.md#php-wasm),
the pinned host package and Chromium:

```sh
LEAN_BRIDGE_PHP_WASM_LIST_TEST=1 node --test tests/php-wasm-lists.test.mjs tests/php-wasm-list-zend.test.mjs
node --test tests/php-wasm-list-contract.test.mjs tests/php-wasm-list-evidence.test.mjs
```

The [PHP-Wasm List suite](../evidence/php-wasm-lists-20260921.md) builds both
source paths, installs the exact npm and Composer archives offline, removes
producer inputs and the handoff, and repeats weak/strict callers in Node and
Chromium. Startup and lazy loading retain separate checks. Synthetic Zend
providers test allocation failures, malformed sequence buffers and PHP bailouts;
they are not Lean execution evidence. CI retains `build/lists/php-wasm.json`
and `build/lists/php-wasm-zend-faults.json`.

Rust's generated callers independently check all 19 public function types per library, including borrowed inputs and owned `Result` values. Wrong types, signed `BigInt` values passed to `Nat` parameters and out-of-range fixed-width literals must fail compilation with the expected diagnostic at the consumer's input. These compiler checks stay separate from executed-case counts and runtime coverage. Additional installed calls reject over-budget strings with `Error::Limit` and recover on a valid call; copied records retain independent nested storage after either side is changed.

C executes 94 positive catalog cases, rejects four negative-Nat cases at runtime, and rejects 26 invalid programs at compile time. C++ executes 92 positive cases, rejects four negative-Nat cases at runtime, and rejects 28 invalid programs at compile time. Both check all 19 public function signatures per library. C11 uses fatal conversion warnings for invalid fixed-width inputs; C++20 uses list-initialization narrowing checks. These are compiler policies, not dynamic range checks by the installed API. Both languages permit integer/boolean and integer/float conversions; C also permits the corpus's zero-valued unit marker as a `uint32_t`. Each accepted conversion must match the corresponding Lean call.

C `Nat` and `Int` use GMP `mpz_t`. C++ uses pinned Boost.Multiprecision cpp_int values. Both reject negative naturals in scalar inputs and nested fields. C archives supply GMP headers, the shared library, source and licenses; C++ archives include Boost headers. CMake and pkg-config configure both dependencies. The callers check exact values beyond 4,096 bits, copied nested storage, and recovery after malformed UTF-8 or oversized strings. C also checks null spans, a null output pointer, invalid unit markers and nested null spans. C cleanup must release each owned result exactly once and tolerate a second clear. These supplemental runtime checks stay separate from the catalog and compiler-rejection counts.

.NET checks all 19 public methods and each record's constructor and property types against independent C# signatures. `Nat` and `Int` use `BigInteger`. Negative `Nat` inputs must throw `ArgumentOutOfRangeException` and leave the next call usable. C# accepts the catalog's integer-to-float conversions; wrong aggregate/boolean types and checked fixed-width overflows must fail compilation with the expected source-located Roslyn diagnostic. These compiler rejections are not runtime range checks.

The .NET consumers also check independent nested-array storage, garbage collection of copied records, null arguments, malformed UTF-16, input and output budgets, and recovery after every error. Garbage-collection checks cover the managed record copies, not native allocation counts or assembly unloading. The existing ordinary .NET suite retains its separate allocation, concurrency and multi-package checks.

Java and Kotlin check all 19 public method signatures and each record's constructor, accessor types and field order against the independent catalog. Kotlin also assigns every method to an explicitly typed function reference. Both use `BigInteger` for `Nat`, `Int` and `UInt64`; smaller unsigned integers use wider signed host types with runtime range checks. Negative `Nat` inputs and out-of-range unsigned values must throw `IllegalArgumentException`, then recover on a valid call. Invalid signed literals and wrong argument types must produce the expected source-located compiler error. Java accepts integer-to-float conversion; Kotlin requires an explicit conversion, so the same unconverted inputs must fail compilation.

JVM consumers check independent copied rows, null arguments, malformed UTF-16, oversized inputs, combined input/output budgets and recovery after each error. These supplemental checks run three times each. The separate ordinary JVM suite retains its concurrency, class-loader and multi-package checks.

Floating-point cases compare exact bits for finite values, signed zero, subnormals and infinities; NaN cases check classification without requiring a payload. The TypeScript consumer compiles with `strict`, `noEmitOnError` and `skipLibCheck: false`. It checks each public function's complete type against independently specified signatures, exercises compile-time invalid inputs with `@ts-expect-error`, then executes the emitted JavaScript against the same Lean oracle.

Host expectations remain explicit. Perl accepts native boolean scalars as integer inputs and integer scalars as floats; those calls must match fresh Lean results. Python and Ruby must reject the same inputs. Perl uses `Math::BigInt` for `Nat`/`Int` and native scalars for fixed-width integers. Rejected Perl inputs must produce the expected diagnostic and leave the next call usable.

JavaScript uses `number` for floats and fixed-width integers through 32 bits, and `bigint` for 64-bit integers, `Nat` and `Int`. Integer-valued float inputs are valid JavaScript numbers; booleans are not integers. Generated npm exports reject wrong types and out-of-range inputs with `TypeError`. All five npm adapters check recovery after each rejection.

Each browser profile gets a separate offline npm installation. React dependencies come from deterministic archives of the repository's locked React, React DOM and Scheduler packages. Vite bundles only that installation's dependencies. The harness then removes the installation and consumer sources, serves the static output under `/corpus/nested/`, and blocks requests outside that deployment. Both fetched WASM assets must match the installed runtime/component hashes and use `application/wasm`.

Browser checks cover repeated calls, recovery after a missing WASM asset, production React and development StrictMode effects, unmount/remount and unmount while WASM loads, and dedicated-worker reuse, termination and restart. Worker results must come from the worker realm. Reports retain each engine/variant's observations and lifecycle checks separately; extra engine runs do not multiply type-position coverage.

Reports appear in `build/type-corpus/`, named for the sorted selected profiles, such as `python.json`, `rust.json` or `node-javascript-node-typescript.json`. The combined npm report is `browser-javascript-browser-react-browser-worker-node-javascript-node-typescript.json`. Reports record the input catalog, declaration checks, per-case observations, archive, runtime, binding IR, dependency, source and oracle identities. Perl also records its separate runtime archive and interpreter ABI. Rust adds compiler/Cargo identities, exact typed callers, compiler diagnostics, dependency locks and vendor checksums, runtime limit checks, and the relocated executable hash. `compileRejectedCases` counts compiler failures separately from `executedCases`; `rustRuntimeRejections` counts the additional limit/recovery checks. npm profiles record both archives; TypeScript records its compiler, consumer source and generated declaration hashes. Browser evidence adds engine versions, framework archives, bundled module paths, static deployment hashes and actual WASM responses. Every report lists all 17 consumer profiles and both source paths. All 17 ordinary-source adapters are implemented. Unsupported or unexecuted cases remain gaps. Separate reports cover compiler-checked reviewed native and Wasm builds. These scoped cases do not change the [type-support inventory](../reference/types.md).

The C/C++ report is `c-cpp.json`. It records GCC identities, public signature and caller hashes, source-located compiler diagnostics, pkg-config and CMake integration, deployed library/executable hashes, and repeated source-free execution. `cFamilyRuntimeRejections` counts the additional 60 invalid-input/recovery checks across both libraries. The two build integrations and repeated executions do not multiply catalog or coverage counts.

The .NET report is `dotnet.json`. It binds the SDK, Roslyn compiler, reference assemblies, public assembly/declarations, exact package lock, installed receipt, consumer source, relocated deployment and runtime-only files. `dotnetRuntimeRejections` counts supplemental runtime error/recovery checks separately from catalog cases and compiler rejections. Repeated execution does not multiply coverage.

The JVM report is `java-kotlin.json`, or `java.json`/`kotlin.json` for a single adapter. It binds both package archives, public declarations, compiler inputs and diagnostics, JDK and Maven tool files, plugin dependency files, offline settings, resolved classpath, installed receipt, relocated classes and runtime image. Kotlin also records its compiler and standard-library files. `jvmRuntimeRejections` counts supplemental runtime error/recovery checks separately from catalog and compiler-rejection cases.

The WIT report is `wit-wasi.json`. It binds the prepared archive, native component/adapter/runtime receipts, pinned Wasmtime file inventory, wasm-tools and GCC identities, parsed WIT and binary interfaces, public caller, compile diagnostics and loaded shared-library paths. It contains 100 executed catalog cases, 24 compile rejections and 84 supplemental error/recovery checks across both libraries. `witRuntimeRejections` counts those supplemental checks; repeat execution does not multiply coverage.

### Reviewed-IR admission corpus

Run the separate reviewed-contract checks with Node and the pinned host Lean compiler:

```sh
bash scripts/bootstrap-toolchains.sh --lean-only
source scripts/env.sh
npm run test:type-corpus:reviewed
```

The two library contracts come from the independent corpus signatures, not generated compiler metadata or the Alpha fixture. The actual CLI validates all 19 declarations in each contract without a compiler. These admission fixtures omit authorized source modules. Builds for all 17 profiles, covering 12 package targets, must return `reviewed-ir-build-unsupported` before tool discovery and leave no release directory. Fast checks also cover combined targets, the Perl alias, direct native/PHP entry points, cached interface claims, conflicting export decisions and malformed review files.

`build/type-corpus/reviewed-ir.json` records 38 analyzed declarations and 34 rejected build attempts. It records zero installed runs, executed consumer cases or observed cells. All 6,562 corpus cells remain gaps in this admission-only report; 697 carry the reviewed-build rejection reason. A separate fresh Lean oracle checks the source fixtures and their proofs. That oracle is not evidence that reviewed IR was compiled. The report binds the catalog, admission implementation, source/dependency snapshots and oracle identities, and rejects invented execution evidence.

The consumer workflow's required `Reviewed IR admission corpus` job uploads `type-corpus-reviewed-ir-<commit>`. A failed command or missing report fails CI. The [admission acceptance record](../evidence/type-corpus-reviewed-ir-20260917.md) preserves the earlier analysis-only milestone.

### Compiler-checked reviewed native corpus

The native corpus supplies explicit modules alongside each independent review, compiles fresh Lean interfaces, and requires the reviewed API to match. Run all eleven native consumer profiles with the same host toolchains listed above:

```sh
npm run test:type-corpus:reviewed-native
```

For a smaller selection:

```sh
LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES=c,python \
  node --test tests/type-corpus-reviewed-native.test.mjs
```

The runner builds each library twice from relocated sources, compares exact archives, removes the author workspace, and installs the copied packages offline. Public consumer calls must match a separately compiled Lean oracle. The report reconstructs the native model from retained metadata and checks the raw review, semantic digest, compiler invocation, source inventory, receipt and oracle identities. Review-only analysis cannot satisfy these checks.

Run the fresh-compiler rejection checks separately with the pinned host Lean compiler:

```sh
LEAN_BRIDGE_REVIEWED_SOURCE_TEST=1 \
  node --test tests/reviewed-source-build.test.mjs
```

These checks cover a namespace that differs from its source module, changed signatures, record field order and nominal identity, exports outside the selected roots, and review-file changes during compilation. Scalar checks also reject changed public names, missing retained reviews and altered invocation evidence. Invalid inputs must stop before native linking or scalar adapter generation and leave no component output.

Reports use `reviewed-native-<sorted-profiles>.json` in `build/type-corpus/`. Each native CI corpus step runs both source paths and uploads both reports in its existing artifact. Observed reviewed cells cover the executed copied-value cases only; they do not promote the full type-support inventory.

The [reviewed native acceptance record](../evidence/reviewed-native-20260918.md) lists the eleven-profile results, compiler rejections and retained identities.

### Compiler-checked reviewed Wasm corpus

Use the npm and PHP-Wasm toolchains from the ordinary-source corpus instructions above. The reviewed corpus uses independently specified contracts for the same two libraries:

```sh
source scripts/env.sh
npm run test:type-corpus:reviewed-wasm
```

Run npm or PHP-Wasm separately with `npm run test:type-corpus:reviewed-npm` and `npm run test:type-corpus:reviewed-php-wasm`. To select individual profiles:

```sh
LEAN_BRIDGE_REVIEWED_WASM_PROFILES=node-javascript,browser-worker \
  node --test tests/type-corpus-reviewed-wasm.test.mjs
```

Each library builds twice from relocated locked sources. Consumers install the reproduced archives offline after the harness removes the author and build directories. npm checks JavaScript, strict TypeScript, browser JavaScript, React and dedicated workers. PHP-Wasm checks weak/strict callers through Node and Chromium, embedded/Composer APIs, and startup/lazy loading. The Shop/Telemetry npm review selects scalar signatures; array and record execution is recorded by `tests/component-arrays.test.mjs` and `tests/component-records.test.mjs`, which also compile independent reviewed contracts. PHP-Wasm checks copied arrays and records in this corpus.

Reports use `reviewed-wasm-<sorted-profiles>.json`. They retain the reviewed bytes, compiler invocation, source inventory and generated API separately from consumer results. Validators reject changed or missing review evidence, inconsistent receipts and attempts to label ordinary-source results as reviewed execution. CI requires both ordinary and reviewed reports in each existing npm/PHP-Wasm artifact.

Check combined reviewed releases with:

```sh
LEAN_BRIDGE_REVIEWED_MULTI_PROFILE_TEST=1 \
  node --test tests/php-wasm-multi-profile.test.mjs
```

This checks all three ABIs together, reversed target order, native/PHP-Wasm, and npm/PHP-Wasm. It requires one compilation per selected ABI, identical relocated archives, agreement on the reviewed input and source API, and execution from relocated installed packages. The PHP CI job runs both ordinary and reviewed variants.

The [reviewed Wasm acceptance record](../evidence/reviewed-wasm-20260918.md) lists the six-profile results, combined releases, rejection checks and retained identities.

CI requires all 17 adapters: C, C++, .NET, Java, Kotlin, Python, Ruby, Rust, native PHP, PHP-Wasm, WIT/WASI, all five npm adapters and all four Perl configurations. Jobs upload `type-corpus-c-family-<commit>`, `type-corpus-dotnet-<commit>`, `type-corpus-jvm-<commit>`, `type-corpus-python-<commit>`, `type-corpus-ruby-<commit>`, `type-corpus-rust-<commit>`, `type-corpus-php-native-<commit>`, `type-corpus-php-wasm-<commit>`, `type-corpus-wit-wasi-<commit>`, `type-corpus-npm-<commit>` or `type-corpus-perl-<configuration>-<commit>`. A failed corpus run or missing artifact fails the corresponding consumer gate.

The [JVM record](../evidence/type-corpus-jvm-20260917.md) lists Java/Kotlin host policies, offline Maven installation and runtime-only execution. The [.NET record](../evidence/type-corpus-dotnet-20260917.md) lists public signature checks and private NuGet restore. The [C/C++ record](../evidence/type-corpus-c-family-20260917.md) lists typed calls, cleanup checks and both relocated build integrations. The [Rust record](../evidence/type-corpus-rust-20260917.md) separates compiler rejections from runtime and ownership checks. The [browser record](../evidence/type-corpus-browser-20260917.md) lists engine, lifecycle and static-deployment checks. The [Node record](../evidence/type-corpus-node-20260917.md) lists the TypeScript checks and unsupported projections. The [Perl record](../evidence/type-corpus-perl-20260916.md) lists installation and ABI checks. The [Python/Ruby record](../evidence/type-corpus-primitives-ruby-20260916.md) and [foundation record](../evidence/type-corpus-foundation-20260916.md) preserve the preceding milestones' cases and artifact identities.

## WASI package

### Ordinary-source WIT packages

Use the pinned Lean compiler, a native C compiler, pkg-config, wasm-tools 1.245.1 and Wasmtime 42.0.1. From this checkout, the Wasmtime build-tool output can be obtained independently:

```sh
nix build .#wasmtime-c-api --out-link build/wasmtime-c-api
bash scripts/bootstrap-toolchains.sh --wasm-tools-only
source scripts/env.sh
export LEAN_BRIDGE_WASMTIME_C_API="$PWD/build/wasmtime-c-api"
LEAN_BRIDGE_NATIVE_WIT_TEST=1 \
  node --test --test-reporter=spec tests/native-wit.test.mjs
```

Cobalt and Saffron each build from two relocated source trees. The suite hides their source directories, extracts the original archives and compiles consumer applications against the installed public headers and libraries. It checks copied values, input rejection, cleanup, shared runtime composition, altered artifacts and atomic build failure. See the [ordinary WIT acceptance record](../evidence/native-wit-20260914.md).

### Native WIT callables

Run the installed callable checks using the author toolchain above:

```sh
LEAN_BRIDGE_WIT_CALLABLE_TEST=1 node --test tests/wit-callables.test.mjs
```

This compiles a 63-export Lean library and its Component Model host on both ordinary-source and independently reviewed paths. The test removes the producer workspace before installing each original archive and compiling a consumer against its public headers. Execution has no compiler or Lean on `PATH`. The consumer checks nineteen primitive mappings, sixteen-argument functions, borrowed and returned ownership, nested calls, deferred close, wrong-thread/session/signature rejection, expired borrows, registry reuse and exhaustion. It also checks that a surviving Lean function remains callable after a callback traps and the helper replaces its component store. CI retains `build/callables/wit.json`.

### Staged WIT callable projection

The separate component projection probe requires no Lean compiler:

With the same pinned Wasmtime C API and wasm-tools, run:

```sh
LEAN_BRIDGE_WIT_CALLABLE_COMPONENT_TEST=1 \
  node --test tests/wit-callable-contract.test.mjs
```

This test supplies synthetic native imports to the generated component. It checks all 19 primitive signatures, borrowed callback handles, owned returned functions, 16-argument invocation, and two callbacks following mixed aligned arguments. It also exercises nested calls, scratch-memory preservation, wrong-signature rejection, double disposal, callback failure and store replacement. Two deliberately broken components must fail: one omits borrow cleanup; the other resets the outer call's memory during re-entry.

The WIT consumer CI job runs both suites alongside the installed copied-value tests. The synthetic probe isolates Component Model ownership and includes compile checks against the generated native C API. The installed suite exercises real Lean callbacks. The [earlier projection milestone](../evidence/wit-callable-projection-20260919.md) records the work before native-host integration.

Run the copied compound acceptance with the same pinned Wasmtime C API:

```sh
LEAN_BRIDGE_WIT_COMPOUND_TEST=1 node --test \
  tests/wit-compounds.test.mjs \
  tests/wit-compound-contract.test.mjs \
  tests/wit-compound-conversions.test.mjs
```

Both source paths build 64 Lean exports. The test checks parsed WIT and compiled
component signatures against an independent catalog, installs the original
archive offline, and relocates the application. Producer sources, the handoff
and installation project are removed before two compiler-free executions.
The consumer checks nineteen primitive payloads, nested options and Unit,
success/error order, binary products, arrays, record fields, malformed values,
copy limits and recovery. Loaded native libraries must match the package receipt.

A separate synthetic conversion probe uses AddressSanitizer, LeakSanitizer and
UndefinedBehaviorSanitizer. It checks injected scratch failures, partial output
cleanup, malformed native flags and unreadable inactive payloads. It does not
claim Lean execution. Required WIT CI retains `build/compounds/wit.json` and
`build/compounds/wit-conversions.json`. The [acceptance record](../evidence/wit-compounds-20260920.md)
identifies the installed archives and probe results.

Run copied Lists through the same installed WIT host:

```sh
LEAN_BRIDGE_WIT_LIST_TEST=1 node --test \
  tests/wit-lists.test.mjs \
  tests/wit-list-contract.test.mjs \
  tests/wit-list-conversions.test.mjs
node --test tests/wit-list-evidence.test.mjs
```

Both source paths compile 27 Lean exports. Independent parsed-WIT and binary
signature checks preserve all nineteen primitive List payloads and nested
copied fields. Relocated offline consumers repeat after removing the producer,
handoff and build tools. Separate sanitizer probes exercise partial conversion,
copy budgets, malformed buffers and cleanup; they do not claim Lean execution.
CI requires `build/lists/wit.json` and `build/lists/wit-conversions.json`.
The [List evidence](../evidence/wit-lists-20260921.md) records exact packages
and checks.

Run named copied variants with the same toolchain:

```sh
LEAN_BRIDGE_WIT_VARIANT_TEST=1 node --test --test-concurrency=1 \
  tests/wit-variants.test.mjs \
  tests/wit-variant-contract.test.mjs \
  tests/wit-variant-conversions.test.mjs
node --test tests/wit-variant-evidence.test.mjs
```

Both source paths compile nineteen exports and exercise 281 constructors,
including empty cases, Unit payloads, named aliases and mixed integer/float
cases. A 257-case family checks the wider WIT discriminant. Independent parsed
text and binary checks preserve family, constructor and field names. Original
archives relocate and execute twice without producer files or compilers.
Separate sanitizer probes check partial conversion, allocation failures,
copy budgets and poisoned inactive payloads. CI requires
`build/variants/wit.json` and `build/variants/wit-conversions.json`.
The [variant evidence](../evidence/wit-variants-20260921.md) records exact counts,
reproduced archives and the Lean constructor-tag boundary.

### Alpha bundle

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
node --test tests/lake-entry-modules.test.mjs
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

This compiles two unrelated dependency-importing projects after their original paths become unavailable, compares relocated releases, installs both npm archives offline, and invokes their public APIs. Their automatically discovered exports use aliases, notation and inferred signatures. The cases cover custom source layouts and declared C inputs with captured headers. The consumer CI workflow runs these cases too.

With the local pinned Lean/Emscripten toolchains and `build/lean-link-spike/lazy` prepared, unset the two path overrides and run `LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/lake-wasm.test.mjs`. This also exercises linker rejection of changed resolution, module order, C headers, source identity, and fresh interface files. Captured-entry cases reject changed metadata even without generators or C inputs. Unsupported implicit, instance, dependent, generic, IO, Task, unsafe, foreign and admitted exports must fail before target adapter compilation. The [ordinary-entry acceptance record](../evidence/lake-elaborated-entries-20260913.md) records this cutover.

### Compiler-owned export metadata

The rich metadata checks need Git and the pinned Lean compiler, without a WASM runtime or Emscripten:

```sh
bash scripts/bootstrap-toolchains.sh --lean-only
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 \
  node --test tests/elaborated-metadata.test.mjs
```

The suite checks structural type projection, aliases, documentation, UTF-16 source ranges, direct theorem references, selection and namespace collisions. It compares relocated reports, rejects altered interface sidecars, and verifies cleanup after extractor execution failures, malformed JSON and cancellation. The Perl consumer CI job runs this suite with its Lean-only toolchain. The [metadata acceptance record](../evidence/elaborated-export-metadata-20260913.md) lists the installed-package regressions.

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

Both captured APIs importing generated code and generated public entry modules have Shop and Telemetry fixtures. The entry fixtures use a type alias and inferred return type. Source-only tests reject forged intent, host metadata, symlinks and oversized inputs without running Lean. Compiled checks reject admitted generated exports and changed metadata between elaboration and target compilation. Use `--test-name-pattern='generated entry'` for the npm entry cases. The [generated-entry record](../evidence/lake-generated-entries-20260912.md) lists their evidence.

These suites hash the selected compiler's complete `lib/lean` tree and take several minutes. The consumer workflows run them after installing the required tools. See the [generated-package acceptance record](../evidence/lake-generated-packages-20260912.md).

## Standalone CLI package

Check the reviewed source allowlist and the tarball-installed executable:

```sh
npm run test:cli-package
```

This checks deterministic archive bytes, excluded private files, executable permissions, local/global/npm-exec installation, reviewed-IR analysis from a read-only installation, and blocked source analysis when no backend is available. It requires Node and npm.

Run the Node-only receipt and installed verifier checks with:

```sh
node --test --test-reporter=spec \
  tests/package-set-receipt.test.mjs tests/cli-verification.test.mjs
```

The package-set unit fixtures use inert bytes to test schema closure, deterministic receipts, corrupted archives, sidecar checks, symlinks, runtime mismatches, dependency cycles, cross-profile name collisions and cancellation. The installed CLI test runs package-set, npm v1/v2 and signed verification with only Node on `PATH`. It needs no compiler or shared runtime.

The compiled `multi-profile-project`, `php-wasm-multi-profile` and `php-wasm-ordinary` suites also copy only real receipts, sidecars and their named archives into fresh directories, then verify them with Node. Their existing installed-consumer checks execute the public APIs separately. These suites require the author and consumer toolchains described above; archive verification does not.

Run the compiler-backed analysis suite with the pinned Lean toolchain:

```sh
source scripts/env.sh
LEAN_BRIDGE_COMPILER_ANALYSIS_TEST=1 node --test tests/compiler-analysis.test.mjs
```

These checks use real Lean through an injected Nix-command transport. They cover fresh interfaces, unsupported declarations, locked dependency relocation, missing locks, source preservation, output tampering and cancellation. They do not claim to execute Nix locally.

For the full author check, prepare the existing shared runtime, then package that runtime with the CLI into a new directory:

```sh
npm run build:cli-package -- \
  --runtime build/consumer-ci-runtime/lazy --output build/cli-package
npm run acceptance:cli-package -- \
  --candidate build/cli-package --output build/cli-package-acceptance --backend nix
```

`build/consumer-ci-runtime/lazy` is the `universal-core-artifacts` runtime prepared by `npm run test:consumer:node`. Another reviewed runtime directory can be supplied explicitly. Select `--backend docker` when using Docker. The daemon must see the same filesystem paths as the CLI installation and acceptance output.

The acceptance runner installs the original CLI tarball with scripts disabled, creates an independent committed Lake project, builds and reproduces its packages without a runtime-path override, then calls the generated exports from a separate installed consumer. It retains the candidate reports and command logs, and removes its own scratch directory after success. It performs no registry upload.

Without either input flag, the packager creates a source-only candidate for packaging tests. `--php-wasm-inputs` includes the separate PHP-Wasm runtime and headers; see [compiler-input packaging](author-toolchain.md#package-php-wasm-compiler-inputs). The PHP-Wasm suite builds with the CLI's bundled inputs, then repeats with a relocated standalone bundle while hiding the default bundle. Neither build selects checkout PHP sources or Lean target archives. `node --test tests/php-wasm-compiler-inputs.test.mjs` checks deterministic assembly, manifests, corruption, symlinks, size bounds and conflicting selectors. Runtime correctness, registry acceptance, namespace ownership, and release approval remain required before publication.

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

### npm primitive callables

The contract profile runs the private callable lifecycle and shared scalar codec checks:

```sh
node --test tests/component-callable-runtime.test.mjs tests/component-scalar-codec.test.mjs
```

The callable suite supplies a synthetic native side. It checks primitive conversions, sixteen-argument callbacks, exception identity, expiration, reentry, disposal, registry limits and cumulative copy budgets. The ordinary installed scalar tests separately exercise the extracted codec against real Lean and verify the U+FEFF string regression:

```sh
node --test tests/component-scalars.test.mjs tests/component-npm-package.test.mjs
```

The installed suite builds ordinary-source and independently reviewed callable packages, installs their verified archives offline, hides producer sources, and runs without compilers on the consumer PATH:

```sh
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit \
  node --test tests/component-callables.test.mjs
```

It checks all nineteen primitives in Node JavaScript, strict TypeScript, browser JavaScript, React and workers. Cases include sixteen-argument functions, exact large integers, callback exception identity, expired borrows, reentry, disposal, registry exhaustion and recovery. CI retains `build/callables/npm/`. The [transport staging record](../evidence/npm-callable-transport-20260919.md) describes the earlier synthetic-only milestone.

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

To repeat one configuration:

```sh
npm run test:consumer:perl -- --configuration 5.38.2-unthreaded
```

The accepted configurations are `5.36.3-threaded`, `5.36.3-unthreaded`, `5.38.2-threaded`, and `5.38.2-unthreaded`. A single-configuration run writes its observation to `build/consumer-ci/perl/<configuration>/perl.json`; only a complete four-configuration run writes the aggregate observation. Each run removes the previous aggregate observation before testing.

To check one runtime containing multiple prebuilt ABIs, set `LEAN_BRIDGE_CPAN_MATRIX_PERLS` to a JSON array of at least two absolute interpreter paths from that matrix, then run:

```sh
LEAN_BRIDGE_PERL_NATIVE_TEST=1 node --test \
  --test-name-pattern='CPAN completes every' tests/perl-native.test.mjs
```

This check prepares the complete runtime before pinning its component, reproduces both archives with the interpreter order reversed, and installs and calls the same component on every selected interpreter. The ordinary installed suite also checks exact `META.json` and `MYMETA.json` runtime requirements, version parsing without numeric rounding, and rejection of both lower and higher runtime versions. Pure contract tests reject resealed payload changes under an unchanged runtime coordinate.

CI runs these four configurations in parallel, with separate toolchain caches and evidence artifacts. The shared compiler/Lake checks and pinned Nix installation run in their own jobs. The combined Perl observation requires every job to pass and retains the warmed Perl 5.38.2 threaded measurement with the CPU information from that configuration's runner.

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
