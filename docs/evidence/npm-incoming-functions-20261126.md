# Borrowing a Lean function inside an npm callback

The application calls `withFunction` with a bundle and a JavaScript callback.
Lean passes the callback both a function and the bundle. The callback can call
the function immediately. To call it *after* the callback returns, the
application must take its own lease with `fn.retain()` and later dispose it.
This is a function passed **into** the application's callback, not a function
the callback returns or a function stored in a record.

The [ordinary npm release](npm-incoming-functions-20261126/ordinary.json)
and the [reviewed npm release](npm-incoming-functions-20261126/reviewed.json)
each passed five consumer checks: Node, a separately compiled strict TypeScript
client, a Chromium page, a mounted React component and a dedicated worker.
The TypeScript client calls through the declaration shipped in the package.
Each client runs the callback twice, once successfully and once with an
application exception. After each return the borrowed function refuses a
call, and its independent lease still works. The thrown exception returns
as the original object. The observer sees two live owners before disposal
and zero afterwards.

These releases contain the same `Owned.lean` source and were built with the
same Lean compiler. Each uses its own authenticated runtime: the older
ordinary release uses `fc8edd62…`, the reviewed release `ae3b114c…`.
The ten executions establish the behavior of those individual packages,
not a same-runtime comparison. For that comparison the paired test verifies
identical runtime archive bytes, downstream source bytes and observations.

The [matched ordinary release](npm-incoming-functions-20261126/matched/ordinary.json)
and [matched reviewed release](npm-incoming-functions-20261126/matched/reviewed.json)
each passed those five clients against the **same runtime archive**. The
[pair receipt](npm-incoming-functions-20261126/matched/pair.json) identifies it
by SHA-256 (`f63c2564…`), alongside the Lean source digest and both package
receipts. The component archives differ. Both installations ran identical
client sources and produced the same borrow expiry, retention and cleanup
observations. The earlier ordinary receipt remains a separate result.

The [release test](../../tests/helpers/npm-incoming-installed.mjs) checks the
compiled signature, verifies both npm archives, installs them offline, and
compares the browser's bundled Wasm assets with the installed bytes. The
three Chromium clients run after the npm install tree is removed. Run
`npm run test:npm-incoming-function` with the JavaScript target runtime,
Emscripten, Lean and Chromium configured, or set `LEAN_BRIDGE_NPM_INCOMING_REPLAY`
to the directory containing the two sealed author-route handoffs.

## Installed C11 clients

Both the [ordinary](c-incoming-functions-20261126/ordinary.json) and
[reviewed](c-incoming-functions-20261126/reviewed.json) releases passed the same six
checks through pkg-config and a separately compiled, relocated CMake client.
On success and failure the callback borrow expired; an explicitly retained
lease still ran. An inner failure left the outer borrow usable, and a foreign
session rejected the live borrow. Only the deliberate session remained after
each case; the broker had zero live identities after shutdown. The two
packages have [distinct ordinary](c-incoming-functions-20261126/ordinary.package-set.json)
and [reviewed receipts](c-incoming-functions-20261126/reviewed.package-set.json)
and the same embedded runtime identity.

To exercise the same lifetime rule with a captured scalar function in C11,
run `npm run test:c-incoming-function` with the pinned Lean compiler. The
[Lean export](../../tests/fixtures/structured-types/visit-quote.lean) passes
the function directly to the [C callback](../../tests/fixtures/structured-types/tariff-incoming.c).
The test builds ordinary and reviewed C archives, then compiles a pkg-config
client and a relocated CMake client. Use `LEAN_BRIDGE_C_INCOMING_KEEP` to
retain the handoffs or `LEAN_BRIDGE_C_INCOMING_REPLAY` to replay them.
If CMake is not at `/usr/bin/cmake`, set `LEAN_BRIDGE_CMAKE` to the absolute
path to its executable. The runner checks it before building Lean. To recover
an interrupted pair, set `LEAN_BRIDGE_C_INCOMING_RESUME` to the **handoff
directory** instead of setting KEEP or REPLAY. It verifies and installs
existing archives, and builds only a missing route. An incomplete or invalid
existing archive fails verification; it is not overwritten.
The npm receipts above do not qualify this C interface.

## Installed C++20 clients

Both the [ordinary](cpp-incoming-functions-20261126/ordinary.incoming.json)
and [reviewed](cpp-incoming-functions-20261126/reviewed.incoming.json)
releases passed the pkg-config and relocated CMake clients. The
[ordinary receipt](cpp-incoming-functions-20261126/ordinary.package-set.json)
and [reviewed receipt](cpp-incoming-functions-20261126/reviewed.package-set.json)
identify distinct archives with the same runtime. After each of six cases
the observer counted one live identity; after thread exit it counted zero.
The first reviewed build timed out in downstream CMake. The passing replay
installed the original sealed archive without rebuilding Lean.

To reproduce, run `npm run test:cpp-incoming-function`. Its
[consumer](../../tests/fixtures/structured-types/tariff-incoming.cpp) takes
the Lean closure directly as a lambda argument. It keeps the borrow and an
explicit lease across success and failure, checks the identity of the thrown
exception, and exercises a failed nested callback while the outer borrow is
still live. The consumer compiles against the generated public header.
Installed qualification requires the same consumer to run from the relocated
CMake package, with the broker returning to baseline after each case and zero
after thread exit. Set `LEAN_BRIDGE_CPP_TARIFF_KEEP` to retain the two
handoffs or `LEAN_BRIDGE_CPP_TARIFF_REPLAY` to replay them. Older Tariff
archives without `visitQuote` do not qualify.

## Native callbacks

C11, C++20, Python, Ruby and Rust adapters passed a downstream callback
that takes a Lean function directly. Each exercised success and failure with
and without retention, nested failure while the outer borrow remains valid,
and a fresh capture. After return, calling the original borrowed function
failed even while the retained copy still returned 45. In Rust the
`visit_quote_with` entry accepts `|quote, n| quote.call(n)` without an
explicit parameter type; the original entry still accepts recovery wrappers.

The independent Rust observer first detected a live native session after the
callback, even though calling the expired wrapper failed. The wrapper held
a strong session reference of its own. With that reference made weak, the
observer saw a known live owner in its positive control, then zero after
each of the six cases and zero after thread exit. Python and Ruby each saw
only the deliberately open session after every case, then zero on shutdown.
Run `npm run test:rust-lease-shapes` with the Rust toolchain and an offline
Cargo cache to type-check the shared session code with transfer-only,
borrowed-result, receiver and callback-result APIs. This needs no Lean rebuild.

This was an adapter replay against the ordinary compiler output, **not** five
package installs. The original Lean source digest is
`8df990ee7666a9ea95544392fd379b3e656eefaaebce56dc1d92fdaa69661793`;
the verified compiled component digest is
`f47f1c5c0e4bf3a66ba28354970f69888b1a0843b254788981c63203f9fb911e`.
Use `LEAN_BRIDGE_FRAME_DIRECT=1` and `LEAN_BRIDGE_FRAME_NATIVE_STAGE` with
`npm run test:callback-frame-facades` to replay an original ordinary stage,
or set `LEAN_BRIDGE_FRAME_C_HANDOFF` instead to use two C package handoffs.
The replay verifies its input and compiles the public clients; no source
change or rebuild of the Lean component is needed.

For installed Python, Ruby and Rust qualification, run
`npm run test:native-incoming-function` with the native build toolchain and
an offline Cargo dependency cache. The test builds one wheel, gem and crate
per author route; it removes the producer before installing the packages.
It checks the installed files against each package manifest, runs the
public clients and broker observers after relocation, and writes a pair
report only when all six installations agree. To retain or replay the
originals, set `LEAN_BRIDGE_NATIVE_INCOMING_KEEP` (an existing parent
directory) or `LEAN_BRIDGE_NATIVE_INCOMING_REPLAY` (the resulting
`sets-*` directory).
