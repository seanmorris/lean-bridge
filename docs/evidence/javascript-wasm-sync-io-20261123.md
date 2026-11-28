# Synchronous Lean IO in installed npm packages

Two npm handoffs exposed 27 functions compiled from Lean 4.32.2 with
Emscripten 6.0.6. The ordinary project selected declarations by name. The
reviewed project selected them in a Binding IR document; its archive retained
the original review bytes. Both component packages depended on the exact same
`@lean-bridge/runtime` archive.

| Archive | Bytes | SHA-256 |
| --- | ---: | --- |
| `@example/ledger-io@1.0.2`, ordinary | 22,071 | `2df90084e0ea80a91f0338bc8c3d1d2b438ace2f5aa5d1210d2c7b4dd4486afa` |
| `@example/ledger-io@1.0.2`, reviewed | 24,302 | `daeb5c336504576c891dca834214f313e00aa31b00d0529f131c7ec4dc855cb5` |
| Shared runtime | 1,648,973 | `4224a3a6b851ed1be9a191ebb0cf388eae3f89070cf5f7ede387c52c0bcafb16` |

A fresh, offline npm installation of the author CLI rebuilt the ordinary
project from a second source directory. Both archive hashes and the root
package-set receipt matched. The receipt verifies local consistency, not
publisher identity.

For each handoff, a downstream application installed the two archives with
`npm install --offline --ignore-scripts`. Node and Chromium each made 45
checks using the public package import. Those included the 19 scalar kinds,
returned versus thrown nested `Except`, the original `IO.Error` message,
copy independence, validation before a state change, and use of the same
counter after a declared failure. Chromium fetched the installed files over
loopback; requests to other origins were blocked. Strict TypeScript compiled a
consumer against the installed declarations, including narrowing the nested
error payload and rejecting a bigint `USize` argument or a promised result.

Five failed builds produced no release directory: a review changed
`Ledger.readTotal`'s return type; the caller requested Docker explicitly;
the author granted filesystem access; the author selected a task; and a Lean
function read a file under an empty effect grant. In the last case the compiler
reported the offending declaration and the filesystem operation it reached.

The [fault tests](../../tests/javascript-wasm-sync-io.test.mjs) exercise a
different boundary: injected traps, malformed outputs, and failed cleanup.
They test the JavaScript frame reader and the shared runtime's retirement
policy; they do not count as executions of the compiled Lean fixture.

The [cross-package callback test](javascript-wasm-callback-io-retirement-20261123.md)
later found and fixed a separate retirement bug using a real compiled Wasm
trap. Its receipt identifies the updated runtime; the hashes above describe
the original synchronous IO build.

## Reproduce

Set up the [synchronous npm author SDK](../publish/npm.md#export-synchronous-lean-io)
and Chromium. In a source checkout supply `LEAN_BRIDGE_RUNTIME_ROOT` for the
prepared `main.mjs` and `main.wasm`, and `LEAN_BRIDGE_JS_TARGET_RUNTIME` for the
pinned wasm32 headers (or use `LEAN_BRIDGE_JS_INPUTS` for the prepared compiler
input package). Run `npm run test:javascript-sync-io-package`. To keep the
handoffs, set `LEAN_BRIDGE_JS_IO_EVIDENCE` to a directory that does not exist.
Use `LEAN_BRIDGE_CHROMIUM` for a system Chromium executable if needed.

This run covers the synchronous, in-memory npm profile on Node and Chromium.
It does not establish worker, React, or asynchronous scheduler coverage.
Nothing was uploaded to a registry.

The [later five-client run](npm-synchronous-io-delivery-20261126.md) uses its
own ordinary and reviewed package receipts. It executes the same assertions
in strict TypeScript, mounted React, and a dedicated worker as well as in
Node JavaScript and a browser page.
