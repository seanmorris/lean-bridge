# A cross-package guest trap in TypeScript and React

The [executed TypeScript client](../../tests/fixtures/javascript-wasm-callback-io/consumer.mts)
enters the trapping callback through the installed package's typed API. The
[React client](../../tests/fixtures/javascript-wasm-callback-io/react.mjs) enters
it from a click handler and retries Ledger from a second click.

| Installed Ledger release | Client observations | Package-set receipt |
| --- | --- | --- |
| Ordinary source | [Node and mounted React](npm-callback-trap-delivery-20261126/ordinary.json) | [Ledger](npm-synchronous-io-delivery-20261126/ordinary.package-set.json) |
| Independently reviewed interface | [Node and mounted React](npm-callback-trap-delivery-20261126/reviewed.json) | [Ledger](npm-synchronous-io-delivery-20261126/reviewed.package-set.json) |

Each route uses the same ordinary [callback package](npm-callback-trap-delivery-20261126/package-set-receipt.json)
and one byte-identical runtime. Each client loads the two packages in both
orders, then either catches the guest trap and returns a valid value, or
rethrows it. Every case starts in a fresh process or browser realm.

All 16 runs passed the [23 common assertions](../../tests/helpers/javascript-wasm-callback-io-calls.mjs).
Ordinary host exceptions and declared IO errors left the peer usable. The
compiled diagnostic executed Wasm `unreachable`; the suspended callback
made **zero** native finish calls afterward, even when its host caught the
trap. Neither component could resume. TypeScript also rejected a promise in
place of the synchronous callback result at compile time. React rendered
`Runtime retired`, then `Peer update refused` after the second click. The
browser used a relocated bundle whose four Wasm hashes matched the installed
components, runtime and diagnostic; the install directory had been removed.

Run `npm run test:javascript-callback-io` with the [author SDK](../publish/npm.md#export-synchronous-lean-io).
For a focused replay, set `LEAN_BRIDGE_JS_CALLBACK_IO_DELIVERY_ONLY=1` and
point `LEAN_BRIDGE_JS_IO_RELEASE` and `LEAN_BRIDGE_JS_CALLBACK_RELEASE` at
their respective package-set directories. The separate [Node, browser and
worker results](javascript-wasm-callback-io-retirement-20261123.md) remain
evidence for those clients; this replay did not rerun the worker tests.
