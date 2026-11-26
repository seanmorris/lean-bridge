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

The [release test](../../tests/helpers/npm-incoming-installed.mjs) checks the
compiled signature, verifies both npm archives, installs them offline, and
compares the browser's bundled Wasm assets with the installed bytes. The
three Chromium clients run after the npm install tree is removed. Run
`npm run test:npm-incoming-function` with the JavaScript target runtime,
Emscripten, Lean and Chromium configured, or set `LEAN_BRIDGE_NPM_INCOMING_REPLAY`
to the directory containing the two sealed author-route handoffs.
