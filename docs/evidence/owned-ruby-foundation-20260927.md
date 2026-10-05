# Ruby ownership foundation

Ruby 3.3.12 executes the ownership runtime against freshly compiled Lean on
both ordinary-source and independently reviewed IR paths. Each path passes
400 assertions and finishes with zero live bridge allocations and zero native
identities. VO1219 remains open. These tests do not establish aggregate
conversion or prepared gem support, and they promote no type-surface cells.

## Ownership and cleanup

Resource wrappers share a checked result lease. Each wrapper has its own
idempotent close guard, so closing a duplicate does not close the original.
The last explicit close releases the native result without waiting for GC.
Explicit retention creates an independent native owner. Borrowed wrappers and
their copies expire when their borrow frame closes.

Ruby copies ObjectSpace finalizers when duplicating an object. The runtime
removes the inherited finalizer before installing the duplicate's independent
guard. Tests retain failed-copy exceptions and check that the original remains
usable. Frozen clones also close correctly.

GC finalizers only mark results for release. They do not take locks or call C
from Ruby's trap context. The creating thread drains those results on its next
entry or during cleanup. A thread-exit hook closes native owners even when an
application retains the dead Thread, resource wrappers, or a suspended Fiber.

The suspended-Fiber regression failed before the fix: ordinary Fiber affinity
checks also blocked thread-exit cleanup. The exit path now releases registered
owners on their creating native thread without requiring abandoned Fibers to
run their ensure clauses. Ordinary cross-Fiber calls remain rejected.

Output scopes hold ownership until the entire conversion succeeds. Exceptions
and nonlocal Ruby exits revoke partial wrappers and release the result, even
when the caller retains those wrappers. Thread interruption cannot interrupt
ownership publication. Forked children reject use before acquiring an inherited
loader lock or entering native code. Resources reject use from another thread.
Ractors and Ruby M:N thread mode are rejected before native entry.

Each source path exercises four native allocation failures, eight Ruby result
allocation failures, two duplicate-allocation failures and three session
allocation failures. The accepted runtime and declaration run passed 6/6 tests,
with no skips, in 113,247 ms.

## Generated declarations and storage

The value generator emits source-named resource classes, immutable record
fields, nested variant constructors, callback signatures and explicit
Some/Ok/Err wrappers. Unit uses a distinct UNIT object. A Ruby consumer executes
68 checks for constructor distinctions, nested options, field order, immutable
fields and function arity. Alias names retain their contract targets without
creating extra Ruby classes. This declaration test does not call Lean.

The storage generator calculates public C sizes, alignments and field offsets
for scalars, GMP pointers, identity handles, containers, records, variants and
callback descriptors. Non-leaf fields use indirection, preserving finite
layouts for recursive types. Separate compiler probes compare those
calculations against authenticated C headers. Both source paths pass 205
mixed-value layout assertions and 93 all-primitive layout assertions. The final
layout run passed 5/5 tests, with no skips, in 165,219 ms.

Reproduce with:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 \
  tests/owned-ruby-runtime.test.mjs \
  tests/owned-ruby-values.test.mjs \
  tests/owned-ruby-layout.test.mjs
```

Set LEAN_BRIDGE_RUBY to select the supported MRI 3.3 executable. Reports live
under build/owned-ruby-runtime, build/owned-ruby-values and
build/owned-ruby-layout. The C shim in the runtime probe converts small Nat
serial numbers; it does not implement Ruby's public arbitrary-precision codec.

The adjacent JSON captures the executed reports, compiler-input hashes, local test
logs and exact source hashes. It records installedPackage as false.

## Remaining delivery

Next are bounded resource-aware aggregate conversions for all nineteen
primitives, native callback trampolines, returned and higher-order closures,
authenticated prepared gems, source-free installation and relocation checks,
catalog and CI integration, and consumer documentation.

The full task also retains the remaining host ownership projections,
transferred inputs, anchored results and Wasm ownership support.
