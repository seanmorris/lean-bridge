# Installed recursive Ruby callbacks and closures

Ruby packages accept finite recursive copied values in synchronous callbacks and
returned Lean closures on ordinary-source and independently reviewed Binding IR
paths. Each RubyGems-only build compiles 33 Lean exports and 18 callback
signatures. C/C++, Python, Rust and Ruby use the same compiler-checked native
payload layout.

## Installed execution

The [execution receipt](ruby-recursive-callables-20260925.json) records both
original gems. Each producer is removed before offline installation. The test
relocates the installed gem and removes its archive handoff and gem cache before
execution. Consumers use MRI Ruby 3.3.12 without Lean, native declarations,
compiler tools or runtime setup.

Each installation passes:

- 379 recursive checks, including trees, captured closures, nested aliases used
  only inside callback signatures, independent copies and depth-limit recovery.
- 51,335 existing acyclic checks across eight copied callback shapes.
- 9,958 injected failures at conversion checkpoints across nine shapes and five
  call paths, using both `NoMemoryError` and another `Exception` subclass.
- Nine direct callback-owner checks before dereferencing native result pointers.
- Creator-thread exit and native thread ID reuse checks, 4,096-slot exhaustion
  and recovery, deferred close, finalizer cleanup and zero remaining identities.
- Cleanup and runtime retirement after corrupting a real owned native result.

Isolated processes remove the callback retention and runtime retirement guards
in memory. Each guard's probe must fail for the expected reason. These probes do
not edit the installed gem. All 28 installed files and the original package
receipt remain unchanged, and the public recursive caller runs again afterward.

Both producers compile the exact [Lean example](../publish/rubygems.md#export-recursive-callbacks-and-closures).
Both installations execute the exact [Ruby example](../consume/ruby.md#recursive-callback-values).
Fresh original packages also repeat the earlier primitive and acyclic callback
acceptance gates.

## Values and ownership

Records and constructors use frozen classes with required keyword fields. Arrays
and Lists use exact Ruby arrays, with independently copied mutable payloads.
Options preserve `nil`, `Some.new(nil)` and `Some.new(UNIT)`. Results use named
`Ok` and `Err` values; products remain nested pairs. Concrete aliases keep their
target representation without extra wrapper classes.

Callback frames retain temporary buffers until native copying finishes and
contain Ruby exceptions and non-local block exits. Callbacks expire at the end
of the exporting call. Returned `LeanClosure` values own captures until `close`,
scoped `with` cleanup or finalization. Invocation belongs to the creating process
and Ruby thread lifetime, not a reusable native thread ID.

Conversion allows 128 value levels, 262,144 visited nodes, a 16 MiB native-copy
budget and a separate 16 MiB conversion-storage budget. These limits do not
bound Lean working memory or every Ruby allocation. Cycles, malformed payloads
and uninhabited values reject. Native reentry allows 64 active calls. Malformed
native output retires the shared runtime; ordinary input and callback failures
preserve usability.

## Inventory and remaining work

The [integration receipt](ruby-recursive-callable-integration-20260925.json)
authenticates exact sources and reversible changes against Rust milestone
`8dcaf9b69beb73b756743e36c075f58c2bc82f86`. It adds exactly four installed cells:
Ruby recursive callback input and output on both source paths. Inventory version
`0.101.0` records 4,802 of 6,562 installed cells. That count describes the type
inventory, not overall task completion.

Perl, .NET, Java, Kotlin, native PHP, PHP-Wasm and WIT/WASI still need recursive
callable acceptance. Resource-containing aggregates require explicit ownership
and remain part of task 1219. These Ruby packages do not accept resources or
callable identities inside copied fields, retained host callbacks, asynchronous
delivery, post-fork reuse, Ractors or M:N threads.
