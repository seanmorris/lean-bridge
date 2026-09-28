# Native PHP public calls and callbacks

The PHP generator now emits public namespace functions, typed callback
descriptors and private native calls for resource-bearing values. Consumers
pass generated value objects, PHP containers and synchronous callables. They
do not construct FFI arguments, native tokens or constructor numbers.

The C shim copies each PHP callback reply through the generated public C copy
or retain operation before the native callback argument owner expires. PHP
scratch storage and input lease pins remain alive until the enclosing call
returns. Callback resource wrappers expire on callback return; `retain()`
creates an independent native owner. Returned Lean closures support invocation,
retention and explicit close. They cannot extend a borrowed PHP callback's
lifetime.

Callbacks that lack an argument-derived recovery value require
`with_recovery(callback, value)`. The generator validates that value against the
callback's actual result type. A recovery value never becomes a successful
public result after a callback failure. PHP receives the original `Throwable`
after native cleanup. Native failures while copying a callback reply retain
their native status instead of becoming a generic callback error.

Ordinary arguments, Lean closure arguments and recovery values share a
validation budget before native loading. Inputs, callback conversions and
result decoding share the call's conversion budgets: 128 value levels, 262,144
visits, 16 MiB of accounted PHP storage and 16 MiB of native conversion data.
These limits do not include all PHP allocator overhead or Lean working memory.
PHP additionally limits call reentry to 64 levels; native scope limits can stop
reentry sooner. Export names that collide with private helpers reject before
compilation.

## Executed coverage

Fresh ordinary and independently reviewed Lean builds each execute the public
API from strict and weak PHP callers. All four runs have identical observations:

- 855 checks, including callbacks that change every one of the 19 primitives.
- 91 injected PHP checkpoint failures and 115 native allocation failures.
- Original exception identity, nested calls, higher-order callbacks, returned
  Lean closures, typed recovery and recursive resource-bearing values.
- Expired callback borrows, explicit retention and closing an input or invoked
  closure during a callback without releasing its active call's lease.
- Rejection of reference arguments, generator callbacks, wrong arity, invalid
  replies and calls from Fibers.
- Reentry stops after 63 callback entries. A repeated-callback request stops
  after 819 invocations rather than completing its requested 10,000.
- Zero live native allocations and zero broker identities after cleanup.

Two additional processes retire the shared runtime inside a callback. Each
performs eight checks and finishes with zero allocations and identities. Cold
invalid calls reject with FFI disabled and never invoke the native loader.

The four main probes total 3,420 checks, 364 injected PHP failures and 460 native
allocation failures. The retirement probes add 16 checks. Generated metadata
covers 27 callback signatures, including higher-order forms.

Run the public API, converters and ownership/shutdown regression together:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 \
  tests/owned-php-runtime.test.mjs \
  tests/owned-php-conversions.test.mjs \
  tests/owned-php-calls.test.mjs
```

The combined run passes all 14 tests with no skips and includes 64 shutdown
cleanup processes. The three selected value-layer tests also pass, including
strict and weak callers across the generated integer-width profiles.

Reports in `build/owned-php-calls/` bind the generated PHP files, native shim,
consumer probes and compiled source identity. The earlier converter evidence
is in [Native PHP ownership conversions](owned-php-conversions-20260928.md).

## Remaining delivery work

These probes configure the authenticated, pinned loader through private test
bootstrap code. They do not install a prepared Composer package or enable CLI
admission. Automatic Composer loading, private GMP isolation, package
coexistence, reproducible release artifacts and installed-consumer evidence
remain separate work. The native PHP profile requires PHP 8.2+ NTS CLI on
little-endian Linux x86-64. PHP-Wasm requires its own Zend ownership transport.
