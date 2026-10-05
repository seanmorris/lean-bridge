# Owned .NET foundations

VO task 1219. These probes compile fresh Lean packages, native adapters, and C#
consumers on Linux x86-64. They do not install a NuGet package or enable a new
type-surface cell.

The [execution record](owned-dotnet-foundation-20260927.json) contains the
compiler inputs, generated-source hashes, local command output, and observations
for the ordinary and independently reviewed compilation paths.

## Lifetime and layout

Each compilation path passes 1,784 runtime checks and 16 retirement checks.
Forty creator threads terminate while callers still hold their `Thread` objects
and resource wrappers. Four more terminate after runtime retirement. The native
thread-exit guard releases their remaining owners, with zero live adapter
allocations, resource identities, or cleanup errors.

C# finalizers queue cleanup. They do not release Lean objects from the finalizer
thread. The creator thread drains pending releases, or its native thread-exit
guard drains the session. Active callback scopes defer cleanup. Borrowed callback
resources expire with their frame; `Retain()` creates an independent owner.
Failed output conversions revoke partially constructed wrappers.

The thread-exit guard runs before the pinned mimalloc pthread-key destructor.
The runtime checks the broker's uncached process identity before loader hooks.
The fork probe runs entirely in native code while a broker lock is held; it does
not claim that the CLR can resume safely after `fork()`.

For each composition build, the C compiler checks 205 storage assertions and the
CLR checks 226. For each scalar build, they check 93 and 90 respectively. These
checks cover size, alignment, field offsets, discriminants, GMP views, and
callback descriptors.

## Values and conversion

Each compilation path passes 679 composition checks and 238 scalar checks.
Fault injection covers 215 managed and 138 native allocation failures per path.
All probes end with zero live adapter allocations and resource identities.

The converters handle all nineteen primitives, records, named variants, arrays,
lists, products, aliases, recursive values, nested options and results, resource
leaves, and returned Lean closures. `Nat` and `Int` use `BigInteger`; `Char` uses
`Rune`. Floating-point round trips preserve signed zero and NaN payload bits.
Lean's `toBits` operation separately canonicalizes NaNs, which the tests check.

Conversion has depth, node, and storage limits. Invalid native discriminants,
Unicode, GMP magnitudes, missing spans, oversized spans, and cyclic values fail
before publication. Input snapshots keep resource wrappers rooted throughout
the synchronous call.

Resource leaves use C# wrapper identity in structural equality. Comparing,
hashing, or formatting a value does not call Lean or retain a resource.

A separate consumer assembly runs with unsafe code disabled. It passes 16 value
checks and rejects eleven invalid programs, including raw-handle access,
incorrect callback signatures, asynchronous callbacks, resource construction,
and attempts to modify init-only properties. A runtime check rejects a forged
variant that tries to use the protected record-copy constructor.

## Remaining integration

Host-delegate trampolines, callback recovery, higher-order callback execution,
authenticated loading, private GMP packaging, installed and relocated NuGet
consumers, and cross-package loading still need implementation and acceptance.
The public declarations already distinguish delegates supplied by C# from
borrowed closures supplied by Lean. Their higher-order signatures compile, but
this record does not claim higher-order host-callback execution.

The converter probes use test-only call forwarding. They do not establish a
published .NET API or package admission. Existing copied-value projections and
their receipts remain unchanged.
