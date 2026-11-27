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

For the separate case where a host callback receives a Lean-created function
directly, set `LEAN_BRIDGE_WIT_TARIFF_REQUIRE_INCOMING=1`. By default this
builds both WIT releases from the Lean author projects. To test another
projection of the **original compiled components**, also set
`LEAN_BRIDGE_WIT_TARIFF_C_HANDOFFS` to the directory containing the
[ordinary and reviewed C handoffs](c-incoming-functions-20261126/ordinary.json).
The test checks each C receipt and archive against its recorded digest, builds
the WIT adapter with the production packager, then installs and runs the same
Wasmtime client. The report identifies the C input; this mode is not a fresh
build of a WIT-targeted author project.

The [ordinary native-component replay](wit-incoming-native-components-20261127/ordinary.json)
passed in the installed Wasmtime host. A borrow expired after the visitor
returned, while an explicitly retained Lean function could still be called
after either success or failure. An inner failure left the outer borrow
usable; a foreign session rejected the live borrow. The independent observer
counted one live identity for the session, three while a lease was held,
one after each case and zero at shutdown.

The two linked receipts cover Lean-produced function fields. They predate
the input record that accepts a caller's C function. Fresh packages must
also build and run a [second Wasmtime client](../../tests/fixtures/structured-types/tariff-wasmtime-inputs.c).
It passes two records with four distinct callbacks through the installed
session and checks the result, each argument, and the live owner count.
It also checks that an invalid callback in the second record prevents
dispatch of the first. Compiling that client against the generated header
checks its C API, but does not count as an installed-package run.

For a bare function passed directly to a visitor, set
`LEAN_BRIDGE_WIT_TARIFF_REQUIRE_INCOMING=1` with `test:wit-function-fields`.
The [application](../../tests/fixtures/structured-types/tariff-incoming-wasmtime.c)
keeps a lease across successful and failed callbacks, checks nested calls,
and refuses a borrowed function in a different session. A
[separate observer](../../tests/fixtures/structured-types/tariff-incoming-wasmtime-observer.c)
checks the broker between calls and after closing the session.
`npm run test:wit-incoming-interface` checks the emitted world and compiles
the client, without claiming that either release has executed it.

The ordinary compiler-stage projection also ran this client against
Wasmtime 42.0.1. The original archive is
`615eae3e47e909ada823f737d0ca04fcc0dd54cc443d5e1e0978ae37be315a93`;
its component is `ac932bad4847438b03f78eaa1bcb158dfdab969a3d8bcadd3011a069aec8477a`.
All 79 manifest members matched the archive and the package used for the
replay. The component satisfied the packaged WIT world. The C application
and independent observer built with the package's pkg-config flags and
ran without author tools on PATH. The broker counted **1** at baseline and
after each completed case, **3** with the retained function still alive,
and **0** after explicit session close, before the process exited.

This run used an authenticated ordinary Lean compiler stage. It did not
exercise a reviewed author handoff, so it does not count as a completed
pair of installed releases.
