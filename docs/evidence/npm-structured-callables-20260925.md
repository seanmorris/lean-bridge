# npm structured callbacks and returned functions

VO 1219. The npm adapter now carries all nine copied shapes through synchronous
host callbacks and returned Lean functions: Array, List, Option, Except, products,
records, variants, aliases and finite recursive values.

Both ordinary Lean source and independently reviewed Binding IR produce installed
packages tested in Node, strict TypeScript, Chromium, Firefox and WebKit. Every
browser runs page, React and worker callers. The component and shared-runtime
archives are verified and relocated, then the producer's sources and builds are
deleted before offline installation. Execution has no compiler on its PATH.

Each public caller passes 133,120 structured checks and 53 rejection cases, plus
8,084 primitive checks across all nineteen primitives in the same package. Strict
TypeScript callers exercise every structured callback and returned-closure shape.
The exact [consumer example](../javascript-typescript.md#structured-callbacks)
executes twice on each source path through the installed public API.

## Ownership and failure behavior

Typed one-element Lean Array carriers hold copied payloads and closure values.
Lean-generated constructors, projections and invocation wrappers handle their
representation. C adapters do not guess constructor or closure layouts. All
arguments validate before decoding or calling Lean.

Native callback arguments have allocation receipts. JavaScript owns callback
reply buffers until the enclosing call returns; native cleanup does not acquire
those buffers. The shared runtime owns callback tokens and returned closure leases
for both primitive and structured packages. It pins a closure before argument
validation, so disposal during a Proxy trap cannot free an active call.

The isolated compiled transport probe covers 115 constructor/operation scenarios,
833 injected native copied-output failures and 998 JavaScript allocation failures.
Each recoverable failure leaves zero tracked copied-output owners and JavaScript
allocations, and a valid retry succeeds. These counters do not measure every Lean
heap object. Probe instrumentation is absent from the installed packages.

Seven separate heaps test corrupted replies, receipts and results, inconsistent
statuses, cleanup traps, original-exception preservation and failed release.
Retired heaps reject further calls without allocator traversal. A corrupted host
reply produces an error notification, not a second host callback invocation.
Primitive and structured calls share the 64-frame reentry limit and 1,024 native
closure capacity; calls recover after ordinary limit rejection and disposal.

Fresh installed primitive-only callback and recursive-copy regressions run against
the same shared-runtime archive in all five npm profiles and three browser engines.
Four cleanup regressions failed before the runtime fix and pass afterward.

## Records and reproduction

- [Execution record](npm-structured-callables-20260925.json): terminal logs,
  original package receipts, browser observations, documentation output and probe
  counts.
- [Integration record](npm-structured-callable-integration-20260925.json): exact
  source changes from `8538d3f`, predecessor receipt hashes and the 180 added
  npm callback-position cells in inventory 0.94.0.
- `tests/component-structured-callables.test.mjs`: installed public acceptance.
- `tests/component-structured-callable-wasm.test.mjs`: isolated native fault probe.

With the matching Lean/Wasm toolchain and shared runtime prepared:

```sh
source scripts/env.sh
export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit
node --test tests/component-callables.test.mjs
node --test tests/component-recursive.test.mjs
node --test tests/component-structured-callables.test.mjs
LEAN_BRIDGE_STRUCTURED_CALLABLE_WASM_TEST=1 node --test tests/component-structured-callable-wasm.test.mjs
```

`LEAN_BRIDGE_RUNTIME_ROOT` selects the matching Wasm Lean headers when they are
outside the default build path. `LEAN_BRIDGE_LAKE_RUNTIME_ROOT` selects the prepared
`main.mjs` and `main.wasm` directory. Consumer CI requires the installed report;
performance CI compiles and requires the isolated probe report.

Resource-containing aggregates, callbacks inside copied fields, asynchronous
delivery and retained host callbacks remain outside this milestone. Native PHP,
PHP-Wasm and WIT/WASI structured callables and recursive callback payloads in the
other profiles remain part of VO 1219. No registry publication occurred.
