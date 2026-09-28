# Installed CLI builds of owned PHP-Wasm packages

The public `lean-bridge build --target php-wasm` command now accepts explicit
aggregate ownership and compiler-checked version-4 reviews. The tested CLI
archive contains the PHP-Wasm compiler-input bundle. Authors supply the pinned Lean
compiler and Emscripten SDK; consumers install prepared npm and Composer
archives without either compiler.

Ownership-aware source capture requires an explicit analysis capability.
Copied-only source readers, JavaScript/npm builds and WIT/WASI builds still
reject these ownership contracts. This change does not claim support for those
targets.

## Installed CLI acceptance

The test packages the CLI, installs its original npm archive offline, checks
all 1,593 installed file identities, and removes the CLI packaging directory.
The CLI builds ordinary source and an independently authored, compiler-checked
review. Both contain 51 exports and 27 callback signatures. Raw PHP source and
runtime environment overrides are removed, so each build uses the compiler
inputs bundled with the installed CLI.

Each project is rebuilt from a relocated source tree. The complete artifact
inventories, npm archives, Composer ZIP and package-set receipts match. Neither
build changes the source files or their timestamps. Direct package reassembly
also produces identical archives. After producer removal, the installed CLI
verifies a handoff containing only the package-set receipt, sidecar and archives.

The resulting packages passed 16 Node API runs, 32 Chromium contexts and 32 Node
coexistence runs. Each API caller passed 169 assertions. Weak and strict callers
used embedded and Composer autoloading with startup and lazy descriptors.
Cleanup and refresh snapshots had zero live identities. The package tests retain
the failure, callback, tamper and cross-package checks described in the
[package milestone](owned-php-wasm-packages-20260928.md).

The enabled test completed in 373.28 seconds with no skips:

```sh
LEAN_BRIDGE_OWNED_PHP_WASM_PACKAGE_TEST=1 \
  node --test tests/owned-php-wasm-package.test.mjs
```

Report: `build/owned-php-wasm/packages-cli.json`.
SHA-256: `3b1c8595331308bae58f30fd0410fde49b7b90aea933295755b718bbe85f7b80`.

## Combined native and Wasm releases

Repeating `--target php-native --target php-wasm` now compiles one captured
ownership API for both ABIs. Native model reconstruction handles owned and
recursive graphs. API comparison validates version-4 contracts and retains
their aggregate ownership policy, while keeping 64-bit and 32-bit layouts
distinct. The build publishes its output directory only after both profiles
and the combined package set pass validation.

The installed CLI passed combined ordinary and reviewed builds with reversed
target order. Both expose 51 exports per ABI. Consumers installed the original
archives, then executed after removal of source and release directories. Each
native PHP consumer passed 241 assertions; each PHP-Wasm consumer passed 169.
The combined handoff verified without producer files or compiler access.

The enabled test completed in 398.82 seconds with no skips:

```sh
LEAN_BRIDGE_OWNED_PHP_WASM_MULTI_PROFILE_TEST=1 \
  node --test tests/owned-php-wasm-multi-profile.test.mjs
```

Report: `build/owned-php-wasm/multi-profile.json`.
SHA-256: `41f5d77809f06e2e458ec68472fef8015a5566af3215c50da066e79a203dd444`.

## Documentation execution

The [author guide](../publish/php.md#export-resource-containing-values) now
shows native, PHP-Wasm and combined builds. The [consumer guide](../php.md#resource-containing-values)
describes checked leases and the rule against first-use extension loading
inside synchronous callbacks.

The documentation test extracts the exact Lean, configuration and PHP examples
from those guides. An installed CLI builds the Wasm release; an offline
Composer installation supplies the unchanged PHP example. It prints `42` twice
inside PHP-Wasm after the author tree has been removed. The enabled test passed
in 64.64 seconds with no skips:

```sh
LEAN_BRIDGE_OWNED_PHP_WASM_DOCUMENTATION_TEST=1 \
  node --test tests/owned-php-wasm-documentation.test.mjs
```

Report: `build/owned-php-wasm/documentation.json`.
SHA-256: `0e796dc5684482219b1a1af12364b93a7c2aee479ced414494d2b7d571d82f37`.

All three tests independently produced the same CLI archive SHA-256,
`d5e7ebd6b7765b41e565e371a9c2f86a5ff16562ba9741a078ea1d762e709f9d`.
The prepared compiler-input identity was
`f20ca6356a1e49d29f94cdb39a6eb74d231f3cbc4e98e4f3223403dde02164ea`.
Local runs selected the pinned verified runtime through
`LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME` and configured PHP headers through
`LEAN_BRIDGE_PHP_SOURCE`. CI setup and default test-runtime preparation remain
integration work.

## Remaining release checks

The installed tests, 27 CLI/source-capture contracts, nine semantic checks,
12 filtered Nix import-closure checks, lint and typecheck pass. The broad documentation
checks detect changed historical source identities, which require an exact
successor record rather than overwriting old receipts. Three generic build
tests also require JavaScript runtime headers and the universal artifact set
that are absent from this detached worktree. This milestone does not claim a
green full suite or promote installed-support cells.

CI wiring, source-history evidence and final integration remain. The full
structured-types goal also includes JavaScript/Wasm and selected WIT/WASI
ownership, transferred inputs, anchored results and cross-language acceptance.
