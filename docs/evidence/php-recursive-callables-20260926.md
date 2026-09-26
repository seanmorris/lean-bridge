# Recursive native PHP callbacks and closures

VO 1219. Native Composer packages accept finite recursive copied values in
synchronous callbacks and returned Lean functions, on ordinary-source and
compiler-checked reviewed-IR paths.

The [execution receipt](php-recursive-callables-20260926.json) records original
archives, installed package inventories, terminal logs and probe observations.
The [integration receipt](php-recursive-callable-integration-20260926.json) records
the exact source transition from `e17c1fe6e137d1a3bbdb65d9a9ec1e49dbc751be`.

## Installed packages

The tests use PHP 8.2.33 NTS CLI and Composer 2.5.5 on little-endian Linux x86-64.
They build only `php-native`, remove producer sources, install the original ZIP
offline with an empty Composer home and cache, relocate `vendor`, remove the
handoff and run without compilers or runtime overrides. Each weak and strict
caller runs twice. Public consumers run again after the isolated probes, and
the complete installed inventory must remain unchanged.

The base package has 33 exports and 18 callback signatures. Its consumer passes
1,130 checks and 389 expected rejections in each caller mode on each source path.
It covers arrays, Lists, options, results, tuples, records, variants, aliases and
recursive trees, using six seeds and distinct arguments, replies and captures.
The mixed package has 98 exports and 59 callback signatures. It adds all nineteen
primitive families and sixteen-argument Unit functions, passing 1,249 checks in
each caller mode on each path.

The author example in [Publishing PHP](../publish/php.md#export-recursive-callbacks)
is compiled verbatim. The standalone example in
[Using PHP](../php.md#recursive-callback-values) runs against every installed
package and prints `42`, `20` and `42` on separate lines.

## Failure and ownership checks

Each source path runs the same probes:

| Probe | Checked result |
| --- | --- |
| Host conversion failures | 1,112,848 assertions; 65,884 injected `RuntimeException` and `Error` failures. |
| Native allocation failures | 22,266 assertions; 619 failed allocation attempts; 170 independent C/PHP layout values. |
| Malformed outputs | Invalid variant tag, cyclic output, an already-retired runtime, impossible pointer length and a missing returned identity. |
| Reply ownership | All nine shapes retain valid storage; an early-release mutant identifies all eight pointer-bearing shapes before decoding. |
| Callback contexts | Expired, null and unknown contexts reject without calling user code. |
| Retirement mutant | Missing runtime retirement fails the named assertion with exit status 1, not a crash or timeout. |
| Closure lifetimes | 8,232 assertions cover capacity, recovery, generation reuse, exception identity, reentry, GC, Fibers and an actual process fork. |
| Asset tampering | Each of the four native libraries rejects independently before Lean loads. |

Host probes instrument namespaced copies in memory. Native probes rebuild only
a copied C adapter, retaining the original compiled Lean component and runtime.
The receipts distinguish these probes from unmodified public package execution.
Failure cases must return native identities and allocations to their baselines.
Repeated callbacks preserve the first exception object; active closure disposal
waits for the current call to finish.

## Reproduce

With the pinned Lean toolchain, a native C compiler, PHP with FFI and Composer:

```sh
export LEAN_BRIDGE_PHP=/absolute/path/to/php
export LEAN_BRIDGE_COMPOSER=/absolute/path/to/composer
npm run test:php-recursive-callables
```

CI requires both `build/recursive-callables/php-recursive.json` and
`build/recursive-callables/php-mixed.json`. Generator contracts reject malformed
inputs in weak and strict PHP with FFI absent, reject re-signed generated-source
drift, and compare eight predecessor packages against frozen whole-package hashes.

## Scope

This adds four inventory cells: native PHP recursive callback parameters and
results on both source paths. Conversion allows 128 levels and 262,144 visited
values, with separate 16 MiB native and accounted PHP-storage budgets. These
bounds exclude Lean working memory and PHP object overhead. Reentry is bounded
at 64 active calls; returned closures share 4,096 native identity slots.

Create and invoke closures in the main PHP context of their originating process.
Closing from a Fiber is supported. Calls from Fibers and post-fork reuse reject;
start a fresh PHP process after a fork. Malformed native output retires the shared
runtime, while existing closures can still close and copied PHP values remain
usable.

PHP-Wasm and WIT/WASI recursive callbacks remain separate work. This milestone
does not add resource-containing aggregates, callable identities inside copied
values, retained host callbacks or asynchronous delivery.
