# Native PHP ownership conversions

The converter generator projects the public owned C API into a finite PHP FFI
schema. It reads field offsets from that schema and preserves records, variants,
aliases, lists, arrays, nested products, Option and Except. Identity leaves use
private native bindings. Consumers do not construct native tokens or Lean tags.

The conversion walk uses explicit stacks, a 128-level nesting limit, 262,144
visits and a 16 MiB accounted budget. It rejects cyclic input objects and native
graphs, malformed tags, missing or misaligned spans, overflowing lengths,
invalid Unicode and noncanonical scalar values.

Nat and Int pass through bounded decimal conversion in the component's linked
GMP dependency. PHP does not declare GMP struct fields or load another GMP
library. The converter registers integer cleanup slots before native allocation.
GMP retains its fatal out-of-memory policy.

Each input resource pins its lease independently of its PHP wrapper. Closing the
wrapper during a call cannot release that call's borrowed input. Returned
identities share the enclosing result lease. Failed decoding releases the
result's cleanup ledger without following the malformed child fields.

## Executed coverage

Fresh ordinary and reviewed Lean builds each run two probes:

- The scalar probe performs 395 checks across all 19 primitives, including
  16,384-digit integers, embedded NUL, Unicode, signed zero, infinities and NaN.
  It distinguishes None, Some None and Some (Some Unit). Each run injects 46 PHP
  checkpoint failures and 27 native allocation failures.
- The composition probe performs 1,286 checks. It compares every field of
  returned aggregates, calls returned Lean closures and a higher-order closure,
  retains identities, rejects malformed results and verifies independent input
  lease pins. Each run injects 120 PHP checkpoint failures and 121 native
  allocation failures.

All four converter runs finish with zero live native allocations and zero
broker identities. The total is 3,362 checks, 332 injected PHP failures and 296
injected native allocation failures. Generated declarations also load with FFI
disabled, before any native library is opened.

Run the converters and existing ownership/shutdown regression together:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 \
  tests/owned-php-runtime.test.mjs \
  tests/owned-php-conversions.test.mjs
```

Reports are written under `build/owned-php-conversions/`. They bind generated
sources, the native integer helper, runtime, probes and compiled source identity.

The probe uses a private call harness. Generated public entry points, PHP host
callbacks and typed recovery, authenticated Composer installation and the
separate PHP-Wasm Zend ownership transport remain open. These tests do not
promote support-table cells or admit prepared packages.
