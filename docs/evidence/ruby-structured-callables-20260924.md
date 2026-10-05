# Structured Ruby callbacks and returned closures

VO task 1219, 24 September 2026.

Original gems run from relocated, offline installations after removal of the
producer project, handoff archives and gem cache. Both ordinary-source and
independently reviewed-IR builds execute the same consumer on MRI Ruby 3.3.12.

The accepted payloads are arrays, Lists, nested options, results, binary
products, copied records, variants and transparent aliases. The fixture has
26 exports and 14 callback signatures. Calls copy callback arguments, callback
results, closure captures and closure results into independently owned values.

Each installation passes:

- 51,335 public checks, including 457 runtime rejections.
- 8,224 injected `NoMemoryError` and custom `Exception` failures at every
  conversion/allocation checkpoint across 40 execution paths.
- 15 invalid native tag or sequence-span rejections.
- The exact [documented Ruby example](../consume/ruby.md#structured-callback-values).
- A repeat public run and unchanged installed-file verification after the
  in-memory fault probes.

Failure probes check scratch-buffer and callback release, zeroed native outputs,
and native closure counts returning to baseline. They cover failure before and
after nested conversion, closure wrapping, repeated invocation and calls through
an already-held closure. Closing an active closure defers disposal until return.
Public calls check exception identity, non-local block exits, Fiber suspension,
creating-thread ownership, expired borrows, nested mutation, GC and fork rejection.

Six predecessor generated packages remain byte-identical. A separate fresh
primitive regression passes 50,912 checks per source path across 60 exports.
The source transition preserves the earlier C, C++, Rust and Python receipts.

The local run uses the existing test-only glibc 2.36 floor override and verifies
the native libraries' required symbols. It does not change the published
platform contract or bypass compatibility checks.

[Execution record](ruby-structured-callables-20260924.json),
[source transition](ruby-structured-callable-integration-20260924.json), and
[generator regression](ruby-structured-codegen-regression-20260924.json).

This milestone promotes exactly 32 Ruby callback cells. Recursive callback
payloads and resource-containing aggregates remain assigned work in task 1219.
It does not enable callback identities in copied fields, retained host callbacks
or asynchronous delivery.
