# Recursive WIT/WASI acceptance

WIT/WASI completes copied recursive acceptance across all seventeen consumer
profiles. Inventory 0.85.0 records 102 recursive input, result and field cells
across ordinary-source and independently reviewed packages. Structured callback
payloads and resource-containing aggregates remain separate work in VO 1219.

## Installed behavior

Both prepared archives pass the [package checks](wit-recursive-packages-20260924.md)
and independent byte-for-byte rebuilds. Consumers install the generated headers,
pkg-config metadata and shared libraries, then execute the compiled Component
Model through the packaged Wasmtime host. They need no Lean toolchain.

The eighteen-export corpus covers finite recursive and mutually recursive
records and variants, all nineteen primitive leaves, copied containers and
transparent aliases. Generated C helpers accept named values and translate them
to finite typed WIT tables. Inputs borrow storage for one call; results own
independent storage that remains valid after session close.

Conversion rejects host cycles and bounds each call to depth 128, 262,144 node
visits and a 16 MiB copy budget. Limit failures preserve the output and session.
Malformed native results retire the shared runtime. The
[composition checks](wit-recursive-composition-20260924.md) cover 32 cross-package
scenarios, four mixed C/WIT scenarios and both relocated documentation examples.
Hash validation passes 71 sanitizer checks; host isolation covers 26 scenarios.
Fresh primitive callable and copied collection regressions also pass on both
source paths.

This acceptance covers Linux x86-64, the 64-bit compiled Lean target and the
pinned Wasmtime 42.0.1 host. It does not add generic, dependent, proof-bearing,
asynchronous or identity-bearing recursive payloads.

## CI regression repair

The ordinary-WIT allocation-fault probe force-included a header that loaded
`stdlib.h` before the generated host could define `_GNU_SOURCE`. Recompiling that
instrumented host failed because the loader declarations were unavailable.
The probe now defines the feature macro before libc headers and includes
captured compiler diagnostics in test failures. The complete enabled ordinary-WIT
suite passes all four tests, including independently rebuilt Cobalt and Saffron
archives and atomic rejection when the pinned engine is absent.

The [regression record](wit-ordinary-regression-20260924.json) retains the original
failure and passing rerun. The [acceptance record](wit-recursive-acceptance-20260924.json)
binds this inventory update to commit `60c4262`, exact source transitions and the
unchanged composition receipts. No registry publication is part of this update.
