# Bounded C++ recursive conversions

VO 1219, 22 September 2026. The
[C++ graph conversion generator](../../src/backends/cpp/copied-graph-conversions.mjs)
connects [owned C++ values](cpp-recursive-values-20260922.md) to the staged native
C graph ABI. Its calls remain private implementation helpers. Public C/C++
package admission and installed-profile coverage have not changed.

## Conversion and ownership

Each call checks every input before constructing conversion views. Checks cover
UTF-8, Unicode scalar values, nonnegative Nat values, active constructors, empty
recursive boxes, nesting, node counts and copy budgets. Integer-size checks read
the pinned Boost magnitude directly, without allocating an absolute-value copy.
Types with no finite constructor remain valid declarations; their values reject
without generating an endless recursive walker.

Input views borrow text and byte buffers. Scoped owners hold integer limbs,
sequence storage and nested views. Sequence views reserve their storage before
exposing pointers. The native call returns a root-owned C result. A scoped guard
clears that root after conversion, including on a native status error, malformed
result or C++ allocation failure. The returned C++ value owns its contents and
retains no pointers into either input views or native result storage.

Arguments and results share a 262,144-node budget, a maximum depth of 128 edges
and 16 MiB of accounted native value storage. A separate 16 MiB budget accounts
for C++ conversion views and copied host payloads. These are conversion budgets,
not a cap on process memory or allocator bookkeeping. The native C adapter also
enforces its own arena budget, including allocation headers.

Returned spans are checked for lengths, null pointers, alignment and address
overflow before access. Native results must come from the authenticated C
adapter and contain readable process addresses. C++ cannot establish the
accessibility of an arbitrary address.

Recursive options and results also exposed a declaration issue: a general
`is_constructible` constraint could recursively inspect itself through a
record's fields. `Box<T>` now admits the generated target value and its named
constructor alternatives through finite type traits. It retains independent
copies and strong copy-assignment cleanup.

## Executable checks

```sh
node --test tests/cpp-copied-graph-conversions.test.mjs

source scripts/env.sh
LEAN_BRIDGE_NATIVE_RECURSIVE_TEST=1 node --test --test-concurrency=1 \
  tests/native-graph-model.test.mjs
```

The independent C++ boundary fixture runs with ordinary compiler warnings and
with AddressSanitizer plus UndefinedBehaviorSanitizer. Sanitizer reports are
fatal. Tests cover mixed scalar payloads, 1,001-bit integers, embedded NUL and
Unicode text, machine-word endpoints, floating-point special values, direct and
mutual recursion, aliases, optional backedges, `vector<bool>`, nested options,
both result branches, empty records and distinct nullary/Unit constructors.
They reject oversized values and malformed returned data, and fail each tested
C++ allocation in turn while checking the ownership ledger. Both narrow and
255-field recursive values exercise the accepted depth and the next rejected
depth.

The compiled fixture builds both an ordinary Lean package and an independently
authored reviewed contract. Each supplies eighteen exports. The independent C++
caller uses the generated values with compiled Lean calls, including a Lean
predicate that checks all nineteen scalar fields. It exercises depth-growing
results and failure at each native-arena and C++ allocation point. The existing
169,840-assertion C stress caller runs against those same components.

Both compiled source modes pass all 469 C++ assertions and 169,840 C assertions.
They produce the same native library SHA-256:
`aa2db3227555cc4a790a09a6364955b64a23999ae5822cf9a8dd2968686da112`.

The compiled C transport lives in a shared library, matching the prepared
package boundary. Directly linking the pinned `libleanshared` into a GCC C++
executable puts its exported unwinder ahead of `libgcc_s`; even a small local
throw/catch probe then terminates. Consumers should link the generated C/C++
package target, whose shared C boundary keeps Lean implementation dependencies
out of the executable's direct link interface.

## Remaining integration

Runtime initialization and retirement remain caller policy. The private helper
accepts a supplied native function after the caller establishes readiness. The
compiled failure-injection test deliberately bypasses retirement to check
cleanup and recovery in isolation. Public admission still requires the runtime
failure policy, the C/GMP value facade, prepared C/C++ archives and ordinary and
reviewed installed-consumer acceptance.
