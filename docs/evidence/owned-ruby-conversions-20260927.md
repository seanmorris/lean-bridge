# Ruby owned-value conversions and callbacks

Ruby 3.3 executes the generated conversions against compiled Lean on both the
ordinary-source and independently reviewed IR paths. Each path passes 278
scalar assertions, 595 mixed-value assertions, six malformed-output assertions
and 485 callback assertions. Every probe finishes with zero live bridge
allocations and zero native identities.

These are compiled integration tests, not installed-gem acceptance. The
prepared loader, gem assembly and consumer documentation still need integration.
VO1219 remains open, with no type-surface promotions from this evidence.

## Values and ownership

The converters preserve all nineteen primitive types, including exact Nat and
Int, signed and unsigned fixed-width integers, Unicode Char, embedded NUL,
binary strings, Float32 rounding, infinity, NaN classification and signed zero.
Independent Lean constructors and predicates check the scalar packet. Nested
options keep None, Some(None) and Some(Some(Unit)) distinct.

Records and variants retain their source names. Arrays, Lists, products,
options, results and recursive values carry resource leaves without copying
their identities. Returned containers own independent storage. Resource
wrappers share checked leases; retain creates an independent native owner.
Input scopes pin those leases, so a callback can close an original wrapper
without invalidating the active native call.

Private pointer-only C forwarders adapt the public C ABI to Fiddle. Typed C
callback trampolines handle leaf arguments passed by value. Independent C
compiler probes verify sizes, alignments, tags, fields, GMP layout and callback
descriptors on each source path.

Conversions reject incorrect nominal types, integer overflow, invalid UTF-8,
cycles, malformed tags and pointer layouts. Inputs, callbacks and results share
depth, visit and byte budgets. The repeated-callback probe stops at 819
invocations when the shared conversion budget is exhausted. A subsequent
independent call succeeds.

## Callback failures and cleanup

The execution probes cover host callbacks, returned Lean closures,
higher-order calls, recursive payloads, nested reentry, typed recovery values
and callback-local resource replies. Borrowed arguments and their copies expire
on return; explicit retention survives. A returned Lean closure cannot extend
a borrowed host callback's lifetime.

Original Ruby exceptions return after native cleanup. Nonlocal return, break
and throw become LocalJumpError after C unwinds. Fiber switching during a
native callback raises FiberError before the switch, including aliased yield.
This prevents an abandoned Fiber from retaining an active C callback stack.

The native callback stress test exposed a thread-termination bug. Masking
Exception deferred Thread#raise but did not defer Thread#kill. The runtime now
masks Object until the native call and ownership cleanup finish, as specified
by [Ruby's interruption API](https://docs.ruby-lang.org/en/3.3/Thread.html#method-c-handle_interrupt).
The compiled tests retain dead Thread objects and escaped wrappers while
checking cleanup, so GC cannot conceal a missing release.

The higher-order test also caught an invalid context pointer on an existing
Lean closure. The forwarder now sets a host context only for host callbacks.

Each source path exercises 299 Ruby allocation-failure checkpoints and 234
native allocation failures across the scalar, mixed-value and callback probes.
The malformed-output probe retains partially constructed wrappers and verifies
that they become unusable immediately. Malformed native results retire the
runtime; ordinary input and allocation failures preserve usability.

## Reproduction

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 \
  tests/owned-ruby-conversions.test.mjs \
  tests/owned-ruby-runtime.test.mjs \
  tests/owned-ruby-layout.test.mjs \
  tests/owned-ruby-values.test.mjs
```

Set LEAN_BRIDGE_RUBY to select MRI 3.3 on Linux x86-64. The conversion reports
are under build/owned-ruby-conversions. Foundation ownership, declaration and
layout reports retain their separate directories.

The full task still includes prepared Ruby gems, the remaining host ownership
projections, transferred inputs, anchored results and Wasm ownership support.
