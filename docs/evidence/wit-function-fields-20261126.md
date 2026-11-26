# Callable fields through an installed Wasmtime session

The [C client](../../tests/fixtures/structured-types/tariff-wasmtime.c) called
the public session API from the [ordinary](wit-function-fields-20261126/ordinary.json)
and [reviewed](wit-function-fields-20261126/reviewed.json) WIT/WASI packages.
Each archive contains a compiled component that conforms to its shipped WIT
world. The client linked against the relocated package with `pkg-config` and
executed on Wasmtime 42.0.1 without the author tools on its search path.

The client retained a function from a record, packed it in another record,
then released the original result owners. The new field still returned 43
directly and 42 through Lean. By contrast, storing a call-scoped host
callback did not extend its life: both attempts to use it failed with
`CALLBACK_FAILED`, made no host call and published no result.

A host callback then returned the surviving **function itself**, which Lean
applied to produce 44. A second callback reported failure; the client kept
its original output value and its existing function still worked. The
broker reported **1 → 8 → 1** live identities across retention and release,
then **0** after session close. The observer attaches to the broker already
loaded by the public API; it is not part of the application contract.

Run `npm run test:wit-function-fields` with the [WIT author prerequisites](wit-sync-io-packages-20261123.md).
Set `LEAN_BRIDGE_WIT_TARIFF_KEEP` to an existing scratch directory to keep
both handoffs, or use `LEAN_BRIDGE_WIT_TARIFF_REPLAY` to run the checks
against the retained archives without rebuilding Lean.

The two linked receipts cover Lean-produced function fields. They predate
the input record that accepts a caller's C function. Fresh packages must
also build and run a [second Wasmtime client](../../tests/fixtures/structured-types/tariff-wasmtime-inputs.c).
It passes two records with four distinct callbacks through the installed
session and checks the result, each argument, and the live owner count.
It also checks that an invalid callback in the second record prevents
dispatch of the first. Compiling that client against the generated header
checks its C API, but does not count as an installed-package run.
