# Recursive PHP-Wasm conversions

The [execution record](php-wasm-recursive-conversions-20260924.json) binds generated
PHP/Zend sources, fresh Lean metadata, the pinned wasm32 runtime and actual
PHP-Wasm 8.4.1 observations. Compiler/package admission and installed recursive
PHP-Wasm releases remain unfinished. This record does not promote installed
coverage or close final cross-language acceptance.

## Conversion and cleanup

Generated public functions accept the same nominal readonly values as the PHP
declaration model. An iterative PHP cursor validates arguments before loading
the private extension and converts them into ordered wire lists. Zend walks
finite descriptors whose field offsets come from the C compiler. Recursive
calls never expose native pointers or Lean constructor layouts to PHP.

The call owns all C scratch, one native output root and one partially built
PHP result tree. Children attach to the result tree before construction, so
Zend bailout cleanup can release incomplete output. Native output is released
before PHP reconstructs its final readonly objects. Allocation and size-limit
failures remain recoverable; malformed output retires the shared runtime.

The walkers preserve the 128-level, 262,144-visit and 16 MiB accounting limits.
They validate exact tags, arities, scalar ranges, canonical decimal integers,
UTF-8, pointer alignment and Wasm memory bounds. Shared acyclic inputs produce
independent returned values; cycles reject.

## Actual execution

Independent C providers test the Zend boundary without claiming Lean execution.
Fourteen fresh interpreter runs cover weak/strict PHP callers and seven permanent
retirement scenarios. Each runs 2,772 assertions and 555 rejection checks.
Every one of 364 C scratch allocation positions and 51 PHP conversion or
construction checkpoints is failed in turn. The PHP checkpoints include 22
input failures and 29 output failures. Tracked scratch and native owners return
to zero after each failure.

Two additional interpreter runs abort after attaching a native result and
during its conversion into PHP strings. Both release the native owner and C
scratch. A subsequent call in the same interpreter succeeds. PHP-Wasm retains
loaded classes between runs, so recovery uses `require_once`.

The separate end-to-end gate builds a fresh shared runtime, compiles ordinary
Lean source, extracts its metadata and connects the generated PHP functions to
the actual typed carriers. It covers eighteen declared exports, including cold
rejection of the uninhabited `Never` input. Both weak and strict callers pass
2,622 assertions and 578 rejection checks, including 158 native allocation
failure positions and 350 Zend allocation failure positions. Each observes one
runtime initialization, one component initialization and no live native or
Zend allocations. Calls after retirement perform no decoding; previously copied
PHP values remain usable.

The shared corpus includes all nineteen scalars, recursive and mutually
recursive values, aliases, nested options and results, 127-link spines and
256-field constructors. The independent provider also covers optional and
result-bearing recursive records. The fresh underlying C transport runs its
169,841 checks and 78 wasm32 boundary checks in two interpreters before the
PHP integration runs.

The [contributor guide](../contributing/testing.md#recursive-php-wasm-conversions)
contains the reproduction commands and required reports. Prepared npm/Composer
packages, installed Node/Chromium consumers, reproducibility and shared-package
loading are the next delivery steps.
