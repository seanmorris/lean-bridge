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

To exercise the same lifetime rule with a captured scalar function in C11,
run `npm run test:c-incoming-function` with the pinned Lean compiler. The
[Lean export](../../tests/fixtures/structured-types/visit-quote.lean) passes
the function directly to the [C callback](../../tests/fixtures/structured-types/tariff-incoming.c).
The test builds ordinary and reviewed C archives, then compiles a pkg-config
client and a relocated CMake client. Use `LEAN_BRIDGE_C_INCOMING_KEEP` to
retain the handoffs or `LEAN_BRIDGE_C_INCOMING_REPLAY` to replay them.
The npm receipts above do not qualify this C interface.

For C++20, run `npm run test:cpp-incoming-function`. Its
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
