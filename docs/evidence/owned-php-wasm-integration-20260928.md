# Public PHP-Wasm ownership integration

The installed CLI builds resource-containing values and synchronous callbacks
for PHP-Wasm from ordinary Lean source and compiler-checked ownership reviews.
The [integration receipt](owned-php-wasm-integration-20260928.json) preserves
the preceding native PHP, wasm32 transport, JVM cleanup and Nix import-closure
receipts. It records exact source changes rather than replacing earlier results.

## Executed coverage

The enabled tests build fresh verified PHP-Wasm runtimes. Installed CLI builds
produce npm and Composer archives with 51 exports and 27 callback signatures.
Independent builds from relocated sources must reproduce those archives exactly.
Consumers execute after the producer files have been removed.

The package matrix runs 80 Node hosts and 160 isolated Chromium contexts across
ordinary and reviewed builds. It covers embedded and Composer autoloading,
startup and lazy loading, both package orders, and weak and strict callers.
The browser harness blocks off-origin requests and repeats each case with a
fresh context and matching asset hashes.

Owned and copied components use the same Lean declaration name to detect
cross-component symbol collisions. Tests call one package from another's
callback, retain and release resources, and refresh the PHP request. Snapshots
require one runtime initialization and no remaining resource identities.
A cold lazy extension must reject first-use loading inside a synchronous
callback without preventing a later ordinary call.

The Zend suites check allocation failures, malformed results, request-abort
cleanup and native PHP Fiber guards. The pinned PHP-Wasm host cannot start
Fibers, so the receipt keeps the native Fiber results separate. The combined
release test consumes native and Wasm packages built from one captured API.
The documentation test compiles the published Lean example and runs its
unchanged PHP consumer, which prints 42 twice.

## Required gates

[Owned PHP-Wasm package tests](../contributing/testing.md#owned-php-wasm-packages)
lists the five CI commands. The PHP job requires all eight reports, uploads them
even when a step fails, and propagates failures to the job result. Contract
mutations reject disabled tests, missing reports and omitted failure checks.

The source-bound evidence checks reconstruct the generated model and Zend
sources. Mutations reject missing browser combinations, changed artifacts,
live resources after cleanup, altered observations and broader support claims.
Historical copied-package checks reconstruct their original generators from
authenticated source edits. They reject current wrappers substituted into an
older receipt. Live package tests continue to use the current generators.
The recursive Zend conversion receipts use the same historical reconstruction
for both independent C producers and compiled Lean. Substituting current wrapper
hashes into either report fails verification even with a matching report hash.
The type-surface index retains its existing support cells; this receipt covers
the named ownership profile rather than claiming completion of the full matrix.

JavaScript/Wasm and WIT/WASI ownership, transferred inputs, anchored results and
cross-language acceptance remain part of task 1219.

## Native PHP CI environment repair

Run 36392672274 failed two native PHP callback tests on revision `d075824`.
Xdebug stopped both ordinary and reviewed recursive callbacks at 256 PHP stack
frames, before the bridge's reentry limit. PHP-Wasm itself passed that run.

The local reproduction loaded Xdebug 3.2.0 into PHP 8.2.33 explicitly, because
the clean consumer environment drops `PHP_INI_SCAN_DIR` and `XDEBUG_MODE`.
Both tests failed with debugging enabled and passed with Xdebug's mode disabled.
Each passing build reached 63 reentries, checked all 19 primitive callbacks,
and ended with no native allocations or resource identities. The integration
receipt retains both complete test logs.

CI now disables the host CLI's Xdebug module before consumer tests and checks
that it is absent under `env -i`. Mutation tests reject an environment-only
substitute, a skipped configuration step, or a non-failing postcondition.
This changes the CI environment, not generated package behavior.
