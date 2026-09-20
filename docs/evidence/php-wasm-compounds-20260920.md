# Installed PHP-Wasm compound values

Task 1219 adds copied `Option`, `Except` and nested binary `Prod` values to
prepared PHP-Wasm npm and Composer packages. Both ordinary source and an
independent reviewed Binding IR contract compile the 64-export acceptance
library. The [machine record](php-wasm-compounds-20260920.json) retains package,
runtime, source, installed-file and browser-request hashes. Base revision:
`020f682d`.

## Installed checks

Each source path runs twelve arrangements, twice each:

- Node with the npm package's embedded PHP files or Composer's installed API.
- Chromium with the Vite-bundled npm descriptor, served below a nested URL.
- Startup and lazy loading, each with weak and strict PHP callers.

Every run passes **46,162 assertions** through the installed public PHP API.
The fixture covers all nineteen primitives inside options, both result branches
and binary products. It checks exact large integers, 32-bit platform words,
IEEE endpoints, Unicode, NUL and arbitrary bytes; nested arrays and records;
24 option layers; independent copied values; invalid payloads; conversion
limits and recovery. None, Some None and Some Some Unit remain distinct.
The compiler-derived signatures must match an independent catalog.

The producer project is removed before installation. npm and Composer install
local archives offline with empty caches and scripts disabled. A second locked
install must leave files unchanged. The application moves to a separate
directory; its install workspace and archive handoff are removed before
execution. Compiler and runtime override paths are unavailable.

All executions preserve the full installed-file inventory. Chromium requests
stay on the test origin and match the recorded deployment bytes. Each run loads
exactly the matching component and runtime. Lazy loading fetches neither during
autoload nor after a rejected input, and loads both on the first valid call.

## Zend boundary probes

A separate wasm32 extension uses the generated Zend adapter with synthetic C
providers. These providers isolate conversion and cleanup behavior; they are
not Lean execution evidence. Both weak and strict callers pass:

- Nineteen injected allocation failures across options, results and nested
  products, with no tracked C scratch or output owners left alive.
- Malformed private-wire shapes, sparse arrays, wrong branch tags, partial
  product inputs and incorrect argument counts.
- Nine malformed outputs: invalid Option/Except flags, missing buffers,
  invalid UTF-8 and oversized payloads.
- Three inactive payload cases containing deliberately unreadable pointers.
- Native and output-conversion bailouts, followed by zero live allocations
  and a successful public call in the same PHP instance.

## Reproduce

Use the pinned PHP-Wasm toolchain and host described in
[contributor setup](../contributing/author-toolchain.md#php-wasm):

```sh
LEAN_BRIDGE_PHP_WASM_COMPOUND_TEST=1 node --test \
  tests/php-wasm-compounds.test.mjs \
  tests/php-wasm-compound-contract.test.mjs \
  tests/php-wasm-compound-zend.test.mjs
```

Required CI retains `build/compounds/php-wasm.json` and
`build/compounds/php-wasm-zend-faults.json`. This run used PHP 8.4.1,
`php-wasm` 0.1.0 and Emscripten 3.1.68. No registry release was published.

## Scope

PHP-Wasm uses `null` or `Some`, `Ok` or `Err`, and exact two-element arrays,
matching native PHP's public compound API. UInt32, UInt64, Int64, Nat, Int and
USize payloads use Brick Math; ISize uses a 32-bit PHP integer. Branch wrappers
are final readonly classes, but arbitrary constructor payloads are not deeply
immutable. Calls validate the concrete declared type before loading code.

Type nesting stops at 32. Validation, Zend conversion and native copying each
have a 16 MiB accounting limit, not a bound on Lean working memory. This
milestone promotes eighteen copied positions. Compound callables, lists,
arbitrary variants, recursive copied types and resource-containing copies
remain separate work. WIT/WASI compound support is not promoted.
