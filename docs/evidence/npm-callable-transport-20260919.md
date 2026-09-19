# npm callable transport staging, 2026-09-19

VO1218 has a private JavaScript transport for primitive callbacks and returned Lean functions. The lifecycle tests use a synthetic native side. Compiler admission, generated Lean/C trampolines and the shared Wasm callable helpers are still pending. Ordinary npm packages continue to reject callable signatures.

## Implemented boundary

The closed private descriptor uses version 3 and `scalar-callable-frame-v1`. Its slots retain scalar ABI 2. Callback signatures accept one through sixteen primitive arguments; component exports accept at most thirty-two arguments. The descriptor rejects unknown types, duplicate identities, unused callback definitions and asynchronous delivery.

Each synchronous call owns an arena and its callback registrations. Callback tokens are never reused during a runtime's lifetime. A token expires when its borrowing call ends. Exceptions remain in JavaScript until the native call returns and cleanup completes; the first exception retains its identity, including `throw undefined`.

Returned functions expose `dispose()`, `disposed` and `Symbol.dispose`. Finalizers enqueue fallback cleanup. The future Wasm helper must pin an active closure independently of its lease, so disposing the function during a callback cannot free an active Lean value. The synthetic transport checks that interaction. A trapped native operation poisons the callable runtime and prevents further invocations.

The transport bounds live callbacks and owned functions to 1,024 each, call depth to 64 and copied payloads to 16 MiB per call. Tests cover overflow and recovery, 2,050 allocate/invoke/dispose cycles, late borrowed callbacks, wrong signatures, nested calls and an owned result populated before a failed return.

## Shared scalar conversion

Ordinary calls and the staged callback transport now use the same scalar-slot codec. It preserves all nineteen primitive representations and refreshes memory views after Wasm memory growth. Decoding rejects malformed tags, flags, padding, Unicode scalars, integer magnitudes and buffers.

The refactor exposed a string bug: the UTF-8 decoder treated leading U+FEFF as a byte-order marker and removed it. The decoder now preserves that code point as user data. The installed scalar regression includes leading and repeated U+FEFF, embedded NUL and supplementary Unicode. It also checks exact large integers, float edge cases, byte-copy independence and two packages sharing one runtime.

## Remaining integration

1. Generate typed Lean and C trampolines from compiler-owned signatures. Preserve explicit arities for returned functions and use one-field closure carriers to prevent Lean eta expansion.
2. Add versioned shared-Wasm dispatch and closure helpers. Pin active Lean references, reject expired or wrong-signature tokens, and release unreturned results.
3. Bind the private descriptor to the compiler-checked Binding IR before linking. Enable the new runtime only for callable packages; retain scalar ABI 2 for copied-only packages. Share poisoned-state checks across both call paths in the same heap.
4. Exercise ordinary-source and independently reviewed installed releases in Node JavaScript, strict TypeScript, browser JavaScript, React and workers. Verify source-free installation, exception cleanup, copied values, cross-package calls and closure lifetimes.

No installed callable coverage advances in this milestone. The inventory remains at 2,302 / 6,562 installed-tested cells. npm's five profiles remain the last family in the primitive callable pass. Existing archive identities and installed evidence scopes remain historical when their source-file hashes are refreshed.

## Reproduce

The transport and codec suites passed 22 tests. The installed scalar and packaging suites passed all 3 tests. The Char and platform-word regressions passed all 4 tests across ordinary-source and reviewed-IR releases, using Node 22.23.2, strict TypeScript, Chromium 151.0.7922.34 and Firefox 153.0. Each browser exercised plain JavaScript, React and workers after offline installation and source relocation. WebKit could not start locally because its system libraries, including `libgstreamer-1.0.so.0`, were unavailable; this run adds no WebKit result.

The repository contract suite passed 1,311 tests with 61 gated skips. Documentation tests passed 66 tests; site tests passed 111. Lint, repository and site type checks, and the site build passed.

The two new contract suites need only Node.js:

```sh
node --test tests/component-callable-runtime.test.mjs tests/component-scalar-codec.test.mjs
```

With the pinned Lean compiler and prepared shared Wasm runtime, run the real installed scalar and packaging regressions:

```sh
node --test tests/component-scalars.test.mjs tests/component-npm-package.test.mjs
```

The [JavaScript and browser acceptance guide](../contributing/testing.md#javascript-and-browser-acceptance) covers browser prerequisites. The Char and platform-word suites exercise both source paths through installed Node, TypeScript, browser, React and worker consumers:

```sh
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit \
  node --test tests/component-char.test.mjs tests/component-words.test.mjs
```
