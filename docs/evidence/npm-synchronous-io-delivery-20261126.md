# Synchronous IO in five installed npm clients

The Ledger component has an immediate `add` operation, an `IO` failure, and
an `EIO` operation whose structured error can also be returned as an ordinary
`Except` value. The application must be able to tell these outcomes apart
without checking a transport tag or awaiting a synchronous call.

| Author route | Installed clients and binary hashes | Package-set receipt |
| --- | --- | --- |
| Ordinary project | [Results](npm-synchronous-io-delivery-20261126/ordinary.json) | [Receipt](npm-synchronous-io-delivery-20261126/ordinary.package-set.json) |
| Compiler-checked reviewed interface | [Results](npm-synchronous-io-delivery-20261126/reviewed.json) | [Receipt](npm-synchronous-io-delivery-20261126/reviewed.package-set.json) |

Each route runs the same [45 assertions](../../tests/helpers/javascript-wasm-io-calls.mjs)
in Node JavaScript, compiled strict TypeScript, a Chromium page, a mounted
React component, and a dedicated Chromium module worker. They cover all 19
scalar kinds, validation before state changes, independent byte copies, and
the difference between returning an error as data and throwing a typed error.
After the declared failures, the counter still accepts its next update.

- The [TypeScript program](../../tests/fixtures/javascript-ledger/consumer.mts)
  executes its typed catch. A nested byte error arrives as a copy with the
  original contents. Treating the synchronous result as a promise or passing
  a bigint for wasm32 `USize` must fail typechecking.
- The [React client](../../tests/fixtures/javascript-ledger/react.mjs) executes
  the assertions inside a click handler and renders `Total: 3`. A [separate
  module worker](../../tests/fixtures/javascript-ledger/worker.mjs) starts
  from zero, runs the assertions on its own heap, and posts its result. The
  page then advances its own counter from 3 to 4.

The gate built the ordinary package twice from different source directories
and reproduced both archives. Five invalid publisher configurations were
rejected, and none left a release directory. It installs each route offline, checks the compiler
metadata against the receipt, and checks reviewed source bytes where present.
The browser bundle contains the installed component and runtime Wasm hashes;
the installation is removed before serving that bundle.

Run `npm run test:javascript-sync-io-package` with the [synchronous npm author
SDK](../publish/npm.md#export-synchronous-lean-io). To replay one prepared
Ledger handoff without rebuilding or running the Lean compiler, pass its
absolute `packages/npm` directory:

```sh
LEAN_BRIDGE_JS_IO_RELEASE=/absolute/path/to/packages/npm \
  node --test tests/helpers/javascript-wasm-io-installed.mjs
```

Set `LEAN_BRIDGE_CHROMIUM` to use a system browser and
`LEAN_BRIDGE_JS_IO_CLIENT_EVIDENCE` to keep the client report. These local
runs do not inject a fatal trap. The [cross-package retirement test](javascript-wasm-callback-io-retirement-20261123.md)
covers that different behavior, including isolation between worker and page.
