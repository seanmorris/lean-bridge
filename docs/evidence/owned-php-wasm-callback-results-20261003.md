# Installed PHP-Wasm callback-result acceptance: 2026-10-03

Lean Bridge accepts callback results whose resource-containing lifetime is
anchored to a callback argument in the PHP-Wasm profile. The frozen
[`owned-php-wasm-callback-results-20261003.json`](owned-php-wasm-callback-results-20261003.json)
record contains the exact compressed installed-package reports and hashes the
implementation that produced them.

The acceptance covers ordinary Lean source and independently reviewed binding
IR in three release configurations:

- no-host packages accept generated Lean closures but reject PHP callables;
- host packages accept generated Lean closures and synchronous PHP callables;
- combined packages compose callback-result anchors with consuming inputs,
  owner-anchored results, and generated receiver methods.

Each of the six releases is built twice through the installed public CLI. The
second build reproduces the component, npm archives, Composer ZIP, and package
receipt. The producer and handoff directories are removed before the original
archives are installed offline into npm and Composer consumers.

Each release runs eight Node executions and eight Chromium executions: embedded
and Composer autoloading, startup and lazy loading, and weak and strict PHP
callers. The 96 executions cover generated `copyArg()` and `copyResult()` owners,
returned Lean closures, raw and whole host replies, callback exception identity,
request refresh, and zero live broker identities after cleanup. Component
receipt mutations and re-signed generated sources are rejected.

The checked environment is the pinned PHP-Wasm 0.1.0 host with PHP 8.4.1 NTS,
Emscripten 3.1.68, wasm32, Node, and Chromium. Callbacks are synchronous. This
record does not claim browser Fiber execution, asynchronous callbacks, or a
general PHP/Lean heap bound.

Run the complete acceptance with a compatible prebuilt copied runtime:

```sh
export LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME="$PWD/build/type-corpus/php-wasm-current-runtime"
npm run test:owned-php-wasm-callback-results
```

Verify the committed evidence without rebuilding the packages:

```sh
node --test tests/owned-php-wasm-callback-result-evidence.test.mjs
```
