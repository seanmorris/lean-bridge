# Prepared PHP-Wasm compiler inputs

Date: 15 September 2026. VO1216, following package-set verification in `6e3e3f01b810e92317842c7a70d921e598c74e3e`.

## Distribution

`scripts/build-php-wasm-compiler-inputs.mjs` assembles a prebuilt `php-wasm-copied-v1` runtime, configured PHP 8.4.1 wasm32 NTS headers, source pins and retained licenses. Assembly runs in Node without Git, configure, Lean or Emscripten. It writes a deterministic, content-named `.tgz`, an archive hash sidecar and an extracted `php-wasm-compiler-inputs/` directory.

The extracted directory contains `php-wasm-compiler-inputs.json` and its mandatory hash sidecar. The reader rejects unknown fields, changed pins, incompatible runtime or header identities, extra or missing files, symlinks, private metadata paths, and oversized files or inventories. Verification snapshots the input bytes before the builder stages them. The sidecars establish consistency, not publisher authentication; recipients need a trusted expected archive hash before extraction.

`build:cli-package -- --php-wasm-inputs DIRECTORY` includes those verified bytes under `runtime/php-wasm/`. The CLI inventory records `phpWasmInputsIncluded` separately from the existing JavaScript `runtimeIncluded` flag. Authors can instead select an extracted bundle with `LEAN_BRIDGE_PHP_INPUTS`. An explicit bundle cannot be combined with raw PHP source or runtime overrides. A corrupt default bundle fails rather than silently falling back to checkout files.

The author still supplies Lean 4.32.2 and the matching Emscripten 3.1.68 installation. Runtime receipts bind the SDK commit and compiler-file hashes. This acceptance used Linux x86-64. No Lean Bridge checkout, PHP source checkout, configure tools or Lean target archives are needed by the installed CLI's prepared-input build. These inputs are not consumer dependencies.

PHP, Zend, TSRM and bundled-header licenses accompany the headers, including PHP-Wasm's Apache license and PIB contributor notice. The source bootstrap now checks `main/php_config.h`, the actual configured header, instead of nonexistent root `config.h`.

## Installed acceptance

```sh
node --test tests/php-wasm-compiler-inputs.test.mjs tests/cli-npm-package.test.mjs
LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1 \
LEAN_BRIDGE_PHP_WASM_BROWSER_TEST=1 \
  node --test tests/php-wasm-ordinary.test.mjs
```

The bundle suite has 24 passing tests, including nested cases. Its binary and header fixtures are inert; they test archive and input contracts, not Lean execution. The separate CLI archive suite has five passing tests. The packaging command succeeds with an empty tool search path, and rejects missing arguments without creating output.

Real acceptance compiles Willow and Aspen through an offline-installed CLI. Each exposes 44 ordinary Lean exports. The first build uses the CLI's bundled inputs, with raw input selectors removed from its environment. The repeated build extracts the standalone `.tgz` elsewhere and uses it while the default installed bundle is hidden. The test also repackages relocated copies of the real runtime and header bytes and compares the original archives exactly.

Both packages execute after source and build directories disappear. Seven Node arrangements cover embedded files, Composer autoloading and Vite-bundled assets in startup and lazy modes, plus mixed loading. Chromium 152.0.7977.75 executes all 88 exports and 20 repeated requests in each mode under a nested URL. One runtime and two extensions load once. Lazy startup, PHP autoload and invalid calls fetch no Lean libraries. Loading-failure checks and the exact published Node and browser examples still pass.

Node version: 22.23.2. PHP-Wasm package version: 0.1.0. Runtime identity: `cf6fd0c4430e142677d32ae69d2f0585c667c1fcabb4b26a43c4d68789b48c5c`.

| Artifact | SHA-256 |
| --- | --- |
| Compiler-input manifest | `3981e67670c7c7ecf2eb96307640fe54f61c4b354873194907002ea6ff561ffd` |
| Compiler-input `.tgz` | `ac7aa8e5e52631425acc80e541153994fb486c933dee2476e201ae866bf69796` |
| Shared npm runtime | `4adf1d0f8308d163cb01ccf4068d5a23716762c4c6fad648866d931f7fb29b2e` |
| Willow npm component | `d10c7c1ff04a594ac3e451b4d77005561296ca569a4f97c3a62c56e94e6761a0` |
| Willow Composer API | `dd4dcb49982895f433fbe2d8add3b4575b938008e5b83e9eaace384ba7d78817` |
| Aspen npm component | `7e6d97dbbf4ee76a2ccd9c4e2a5ca142d1360354f2b94ad46d84a3ee059b4f12` |
| Aspen Composer API | `949be46a83b697e76a91def4ba701b6b321bcf72ed085478f06201757f659619` |

The runtime, both compiled extensions and all consumer archive hashes are unchanged from the preceding milestone. The compiler-input archive is a new author artifact.

## Combined targets and regression checks

```sh
source scripts/env.sh
LEAN_BRIDGE_PHP_MULTI_PROFILE_TEST=1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
  node --test tests/php-wasm-multi-profile.test.mjs
```

The Telemetry suite passes with a prepared PHP-Wasm bundle for all three targets, reversed target order, PHP-Wasm plus native PHP, and PHP-Wasm plus JavaScript. It compiles once per requested ABI, retains source API `73e9e4629ce4fb494dd34fddfc12c4f933bc555fc604db4068ffec79a94fb298`, reproduces relocated release records and executes the installed packages. The local JavaScript engine uses an injected Nix-command transport with the real pinned compiler; this does not claim local Nix execution.

Core contracts: 671 passed, 52 toolchain-gated skips. Documentation: 64 passed. Site/demo tests: 111 passed. Lint, checked JavaScript, type inventory, generated references, site typecheck and production site build pass. Installed type cells remain 656; this milestone changes delivery, not the accepted type surface.

No registry package, GitHub release or Pages deployment was published by these checks. Full author-toolchain installers, additional host-platform acceptance and the broader VO1240 metadata/license/dependency audit remain separate work.
