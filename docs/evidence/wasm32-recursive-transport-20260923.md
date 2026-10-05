# Recursive wasm32 C transport

The [execution record](wasm32-recursive-transport-20260923.json) binds fresh Lean
metadata, generated C, the pinned compiler/runtime and two actual PHP-Wasm runs.
This stage implements the C transport. Generated PHP-to-Zend graph conversions
and installed recursive PHP-Wasm packages remain unfinished.

## Target widths

The finite layout planner accepts an explicit 32-bit machine-word model.
`USize` and `ISize` use four-byte C fields; `UInt64` and `Int64` retain eight
bytes. Nominal identities, alias targets and recursive boxing decisions stay
unchanged. The adapter checks pointer and `size_t` widths at compile time.

Lean boxes `UInt32`, `Int32` and `Char` on wasm32. The adapter validates the
scalar box before unboxing. It also checks current Wasm memory bounds before
reading input buffers. Recursive results retain one root-owned allocation arena;
cleanup does not follow result tags, lengths or child pointers.

The default 64-bit path produces byte-identical artifacts for three independent
contracts, both with and without shared-runtime initialization. The record keeps
all six pre-change artifact hashes and the two original generator sources.

## Execution

The test builds a pinned shared runtime in its temporary workspace, compiles
fresh Lean source and typed carriers, then invokes an independent C caller from
a test-only Zend entry point. Both fresh PHP-Wasm 8.4.1 interpreters report
32-bit PHP integers and machine words. Each passes 169,841 transport checks and
78 additional boundary checks, with zero live output allocations afterward.

The eighteen exports cover all nineteen scalars, recursive and mutually recursive
values, aliases, nested options and results, empty cases and copied shared
inputs. The caller tests 127-link spines, 256-field constructors, value/visit
limits, allocation failures, malformed carriers, poisoned result fields and
recovery. Wasm-specific checks reject out-of-memory-range pointers and invalid
boxed scalars before reading their payloads.

PHP's release headers define `NDEBUG`, so the probe uses unconditional checks.
Clang's `-fbracket-depth=4096` setting permits the wide generated carrier source;
the transport's value-depth, visit and allocation budgets are unchanged.

The separate fresh native regression passes 169,840 runtime checks across the
same eighteen exports. All twenty-four C/C++ layout tests also pass.

The contributor guide contains the
[reproduction command](../contributing/testing.md#recursive-wasm32-transport).
This record does not promote installed-profile coverage or close the shared
source-verification and complete cross-language acceptance work.
