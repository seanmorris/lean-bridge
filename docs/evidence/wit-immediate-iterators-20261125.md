# WIT synchronous cursors: component interface

The [Dials fixture](../../tests/fixtures/native-immediate-cursor/Dials.lean)
compiled to a Component Model binary with three distinct cursor resource types.
A factory returns an **owned** cursor. Its next function takes a **borrow**
and returns an optional item, with a separate error result when the Lean
pull can fail. Dropping the owner rather than borrowing it is what ends its
lifetime. No poll or cancellation operation is in this interface.

The [world test](../../tests/helpers/wit-sync-io.mjs) elaborated the Lean
source, generated WIT and WAT, then used `wasm-tools 1.245.1` to assemble and
validate the binary and check that it implements the advertised world.
Changing the first pull from `borrow` to `own` made the independent world
check fail. Binary SHA-256:
`f2f4def1216299df14aacf49de12a0f2c5db75ff28f52f1241bf8936bc32ec27`.

Running the complete world test caught a regression outside the cursor
fixture: the Lean extractor rejected ordinary packages that omitted the
optional `iterators` key. The extractor now defaults only a missing key to
an empty array. Journal, Ledger, Journal with 19 additional scalar exports,
and Dials all passed. An explicit JSON `null` still failed at the extractor.

To reproduce with Lean 4.32.2 and `wasm-tools` installed, set
`LEAN_BRIDGE_LEAN_PREFIX` and `LEAN_BRIDGE_WASM_TOOLS`, then run:

```sh
node --test --test-name-pattern='WIT IO world agrees with checked Dials' tests/helpers/wit-sync-io.mjs
```

This is interface evidence only. A Wasmtime consumer still needs to open a
real cursor, pull through the compiled Lean implementation, and demonstrate
cleanup on exhaustion, failure, early drop and shutdown. The synchronous
host builder refuses this world until it can own those resources.
