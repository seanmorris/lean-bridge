# Installed PHP-Wasm ownership packages

The PHP-Wasm component builder now compiles resource-containing values and
typed callbacks into the prepared npm and Composer package format. The
packages use the existing shared runtime and descriptor loader. Consumers do
not configure FFI, native pointers or numeric resource tokens.

This milestone covers component generation and installed-package execution.
Public CLI admission, the final source-history receipt, CI wiring and support
table promotion remain separate integration work.

## Authenticated compilation and packaging

`php-wasm-owned-model.mjs` binds compiler metadata to the explicit ownership
contract, typed Lean carriers and a 32-bit Zend layout. The component keeps
the shared target identifier `php-wasm-copied-v1`; its schema-version-7 model
records `ownedGraph.transport = "owned-zend-v1"` and the layout digest.
The generated Zend manifest identifies the ownership transport separately.

The artifact reader regenerates the Lean adapters, C sources, PHP classes and
manifest from captured compiler inputs. It rejects changed word sizes,
ownership capabilities, callback signatures, layouts and source files, even
when an outer file inventory has been updated to match the modified bytes.

Prepared output contains the component npm archive, its matching runtime npm
archive and a companion Composer ZIP. npm resolves the runtime dependency.
The descriptor mounts either bundled PHP sources or the Composer application's
`vendor` tree. Both arrangements support startup and first-call loading.

Resource wrappers own checked leases. Callback arguments borrow resources for
the callback's lifetime. `retain()` creates an independent wrapper, and
`close()` releases one. Returned Lean closures use the same operations.
Options preserve `Some(null)` and nested options; results preserve success and
error identity. Scalar mappings retain the exact 32-bit PHP policy inside
aggregates and callbacks.

## Installed checks

`tests/owned-php-wasm-package.test.mjs` builds the ordinary fixture and an
independently authored, compiler-checked contract. Each contains 51 exports
and 27 callback signatures. The test independently rebuilds both components
and compares complete artifact inventories and package archives.

The test installs original archives with offline npm and Composer, relocates
the installation, and removes the author tree before running consumers.
Node runs with no compiler on its PATH. Vite bundles the installed descriptor
for Chromium, served from a nested URL with external network requests blocked.

Each installed PHP caller exercises 19 scalar callback kinds and 23 structured
roundtrips, including empty constructors, mixed records, recursive values,
aliases and nested options. It checks expired borrows, retained wrappers,
returned and higher-order closures, typed recovery, original exceptions,
malformed inputs, cycles and depth limits. Weak and strict callers use both
autoload arrangements and loading modes. Chromium repeats each case in a
fresh context.

A separately compiled observer reads the production runtime broker. It does
not change the installed archives or add public diagnostic exports. It checks
live identities after cleanup and after interpreter refresh.

The coexistence test installs a copied peer beside the owned package. Both
Lean projects declare `Owned.serial`, with different semantics, so shared
symbol interposition would change the observed results. The test covers both
registration orders, all four loading-mode pairings and both autoload
arrangements. Cross-package callbacks, resource retention, request refresh
and shared initialization use the original installed APIs.

## Synchronous callback loading

The coexistence test exposed an unhandled trap when a callback first used a
lazy peer. Loading the peer could suspend PHP-Wasm with uninstrumented Lean
frames on the stack. Emscripten requires Asyncify instrumentation for dynamic
modules that participate in an asynchronous unwind. See the
[dynamic-linking guidance](https://emscripten.org/docs/porting/asyncify.html#asyncify-with-dynamic-linking).

The shared PHP loader now rejects first-use loading inside a synchronous Lean
callback before attempting `dl`. The error does not poison the loader.
Already-initialized peers remain callable. Use the peer's startup descriptor
or make its first call before entering the callback, including after
`php.refresh()`. The callback guard covers owned, recursive copied and acyclic
copied Zend callbacks. Native 64-bit Zend generation does not use this guard.

The pinned host also cannot start PHP Fibers. Those limitations do not change
the ownership rules; asynchronous callback support needs a different calling
contract and compilation path.

## Reproduction

Use the pinned Lean compiler, PHP-Wasm Emscripten SDK, PHP 8.4.1 headers and
PHP-Wasm 0.1.0 host. `LEAN_BRIDGE_PHP_SOURCE`, `LEAN_BRIDGE_PHP_EMSDK` and
`LEAN_BRIDGE_PHP_WASM_HOST` select those inputs. Set
`LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME` to the verified shared runtime directory.

```sh
LEAN_BRIDGE_OWNED_PHP_WASM_PACKAGE_TEST=1 \
  node --test tests/owned-php-wasm-package.test.mjs

node --test \
  tests/owned-php-wasm-model.test.mjs \
  tests/php-wasm-copied-package.test.mjs \
  tests/php-wasm-callable-contract.test.mjs
```

The installed report is `build/owned-php-wasm/packages.json`. Generated API
allocation-failure and malformed-output checks remain in
`tests/owned-php-zend-generated.test.mjs`. Copied callback regressions use
`tests/php-wasm-recursive-callable-generated.test.mjs` and
`tests/php-wasm-structured-callable-zend.test.mjs`.

The verified installed run completed in 362.43 seconds with no skips. It ran
16 Node API cases, 32 Chromium contexts (16 cases, each repeated) and 32 Node
coexistence cases. Each API caller passed 169 checks. Both builds rejected 16
modified artifacts and reproduced their archive bytes independently. The
coexistence runs rejected 32 cold callback loads across initial and refreshed
requests, then successfully called those peers outside and inside callbacks.
Every final broker snapshot recorded zero live identities and one runtime
initialization.

The report SHA-256 is
`31b37a7211a9ffbfcc39f59b33e09448d50fd34884626e7b665b79a7835e88d6`.
The model, descriptor and callable contracts passed 27 tests; the filtered
source-boundary checks passed 12, and CLI packaging passed 5. Lint and repository
typecheck passed. The owned generated-call regressions repeated all 5,396
assertions, 1,064 allocation failures, 32 abort-recovery cases and 18 malformed
outputs. Recursive copied-call regressions and structured copied-call allocation
checks also passed. These targeted checks do not replace the pending final
source-history and cross-language release gates.

The full structured-types goal still includes JavaScript/Wasm ownership,
selected WIT/WASI ownership, transferred inputs, anchored results and final
cross-language acceptance. This package milestone does not close that goal.
