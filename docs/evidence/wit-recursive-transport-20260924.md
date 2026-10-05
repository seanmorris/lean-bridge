# Recursive WIT transport

The development adapter calls compiled Lean through a real WebAssembly Component
Model binary. Ordinary-source and independently reviewed Binding IR builds passed
the same consumer checks: nineteen scalar types, mixed recursive values, growth,
joining, 64-bit words, independent result ownership and recovery after a trapped
call. The two-path native gate passed in 319.8 seconds.

WIT cannot declare recursive types directly. The generator emits finite typed
node tables and references. Its manifest retains the original Lean declarations,
field names, constructors and aliases, and identifies the generated wire schema
separately. Typed C helpers perform conversion for callers and invoke the compiled
component. Returned graphs own independent storage and remain valid after the
Wasmtime session closes.

Input checks run before the provided call helper lets Wasmtime copy an argument.
They reject unknown constructors, misplaced fields, invalid references, cycles and
unreachable table entries. Shared acyclic values count against the expanded visit
budget. The limits are 128 nested levels, 262,144 visits and separate 16 MiB input
and output conversion budgets. Malformed native results retire the shared runtime;
allocation and conversion-limit failures do not.

The address, undefined-behavior and leak sanitizer gate passed fourteen value
round-trips, thirteen malformed-input checks, 263 malformed-output checks,
132 injected scratch-allocation failures and input/output budget failures. Its
allocation ledger ended at zero. Parser checks also cover an eighty-alias chain,
empty versus Unit constructors, uninhabited recursive families, wide fields and
primitive-only signatures.

Run the development gates with the pinned compiler and Wasmtime C API available:

```sh
node --test tests/wit-copied-graph-model.test.mjs
LEAN_BRIDGE_WIT_GRAPH_TEST=1 node --test tests/wit-copied-graph-conversions.test.mjs
LEAN_BRIDGE_WIT_GRAPH_NATIVE_TEST=1 node --test tests/wit-copied-graph-native.test.mjs
```

The compiled checks write `build/recursive-wit/conversions.json` and
`build/recursive-wit/native.json`. The native test builds the admitted C carrier
and adds the development WIT adapter. It does not build a prepared WIT package.
The [registration record](wit-recursive-registration-20260924.json) preserves the
preceding source inventories and receipt checkers through exact reversible edits.
Historical compiled receipts remain unchanged.

The package builder now admits recursive values for `wit-wasi` and ships typed
headers, stable container aliases and the graph-aware Wasmtime host. See the
[package checks](wit-recursive-packages-20260924.md) for source-free execution and
library-lifetime results, shared-backend regressions and source-history checks.
Cross-package composition, an executed consumer example and installed acceptance
remain open. The support
inventory remains at sixteen accepted copied-recursive profiles out of seventeen.
Structured callback and closure payloads, resource-containing aggregates and full
cross-language acceptance remain part of VO1219.
