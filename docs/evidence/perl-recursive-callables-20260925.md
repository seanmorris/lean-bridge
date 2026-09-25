# Installed recursive Perl callbacks and closures

CPAN packages accept finite recursive copied values in synchronous callbacks and
returned Lean closures on ordinary-source and independently reviewed Binding IR
paths. Each CPAN-only producer compiles 33 Lean exports and 18 callback signatures.
The Perl adapter uses the same compiler-checked native payload layout as C, C++,
Python, Rust and Ruby.

## Installed execution

The [execution receipt](perl-recursive-callables-20260925.json) records 16
installations: both source paths, Perl 5.36.3 and 5.38.2 with and without interpreter
threads, and both `prebuilt-only` and `build-xs` modes. Consumers install the
original runtime and component archives after producer removal. Installations
relocate and run after handoff removal without Lean or compiler tools.

Each installation passes:

- 206 recursive checks on threaded Perl, or 204 on unthreaded Perl, including
  trees, captured closures, nested aliases, independent copies and depth limits.
- 64,983 existing acyclic checks across eight copied callback shapes.
- 156,396 fault assertions, including 39,045 injected failures across nine shapes,
  four value seeds and five call paths. Probes cover host and native allocation
  failures, string and object exceptions, and signal-handler exceptions.
- Nine callback-owner checks before dereferencing native reply pointers.
- 4,096-slot exhaustion and recovery, stale handles, deferred close, automatic
  finalization, fork-child finalization isolation and zero remaining identities.
- Exactly-once cleanup and runtime retirement after corrupting a real owned
  native result.

Isolated test libraries compile from copies of the original archived XS and
installed runtime headers. Removing reply retention must reject all eight
pointer-bearing shapes before decoding; the nested Option Unit shape is entirely
inline. Removing retirement must reject runtime reentry. Both failures must
produce their expected Perl exception with a normal exit, not a fatal signal.
All 24 installed files remain unchanged, and public callers run again afterward.

Both producers compile the exact [Lean example](../publish/cpan.md#export-recursive-callbacks-and-closures).
Every installation runs the exact [Perl example](../consume/perl.md#recursive-callback-values).
Fresh original packages also repeat the earlier primitive and structured callback
gates on all four interpreters.

## Values and ownership

Records and variants use named classes and constructors. Arrays and Lists use
plain array references. Options distinguish `undef`, `Some(undef)` and nested
presence. Results use named `Ok` and `Err` values; products remain nested pairs.
Nat and Int use `Math::BigInt`. Concrete aliases keep their target representation.

Callback frames retain replies until native copying finishes. Exceptions preserve
their object identity and return after cleanup. Callbacks expire at the end of
the exporting call. Returned `LeanClosure` objects own captures until `close` or
finalization; closing during invocation defers disposal. Private XS magic stores
their leases, with no public pointer or token. Invocation belongs to the creating
process and interpreter thread. A forked child's finalizer cannot enter inherited
native locks.

Conversion allows 128 value levels, 262,144 visited nodes, a 16 MiB native-copy
budget and a separate 16 MiB conversion-storage budget. These limits do not bound
Lean working memory or every Perl allocation. Cycles and malformed values reject.
Native reentry allows 64 active calls. Malformed native output retires the shared
runtime; ordinary input and callback failures preserve usability.

## Inventory and remaining work

The [integration receipt](perl-recursive-callable-integration-20260925.json)
authenticates exact sources and reversible changes against Ruby milestone
`7cf6ee0bf049502eb9b581c8cc6efb88dc9aeddc`. It adds exactly four installed cells:
Perl recursive callback input and output on both source paths. Inventory version
`0.102.0` records 4,806 of 6,562 installed cells. That count describes the type
inventory, not overall task completion.

.NET, Java, Kotlin, native PHP, PHP-Wasm and WIT/WASI still need recursive callable
acceptance. Resource-containing aggregates require explicit ownership and remain
part of task 1219. These Perl packages do not accept resources or callable
identities inside copied fields, retained host callbacks, asynchronous delivery,
serialization or post-fork reuse.
