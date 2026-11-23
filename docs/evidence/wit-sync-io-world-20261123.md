# Does the compiled WIT world distinguish a failure from a returned result?

Yes, at the Component Model interface. For example,
[`Journal.choose`](../../tests/fixtures/native-sync-io/Journal.lean) can either
return or throw the same `Except UInt32 String`. The generated WIT signature
has two result layers:

```wit
type payload = result<string, u32>;
type outcome = result<payload, payload>;
```

Here the aliases are named for readability. `ok(err(37))` means the call
returned `Except.error 37`; `err(err(37))` means the call threw that
payload. An `IO.Error` occupies the outer error arm as a message. `BaseIO`
has no outer error arm. The original Binding IR still records each Lean
effect and its required native-host capabilities. A filesystem call in the
supplied native host is not a grant from a WASI sandbox.

The [projection test](../../tests/helpers/wit-sync-io.mjs) compiled the Lean
sources, generated each binary component, and ran both `wasm-tools validate`
and `wasm-tools component targets` with version 1.245.1. The latter checks
the binary against the *separately supplied* WIT world, including named
types. Every binary passed its own world and failed an altered one that
replaced the result of `choose` with `bool`. A changed reviewed result with a
fresh IR digest, an incorrect expected IR digest, and a task selection were rejected.

| Lean fixture | Exports | Component SHA-256 |
| --- | ---: | --- |
| Journal, including filesystem effects | 6 | `b78f43b6ad77e2d63aa674ff6dd53f8370ff597f05d161a24452c70f87a6f197` |
| Ledger, in-memory effects and machine integers | 7 | `e08bcdc849aab133f8eea9088544faf94ca5915496cf6a598690775cfdb9acd0` |
| Journal plus all 19 scalar types and an additional nested `EIO` | 26 | `3df472ad21ddcf5becd2a6f2be18e9497ac776aa30a4956e5dd9fee85fb7b1f7` |

Set `LEAN_BRIDGE_LEAN_PREFIX` to Lean 4.32.2 and `LEAN_BRIDGE_WASM_TOOLS`
to the pinned `wasm-tools` executable, then run:

```sh
node --test --test-concurrency=1 tests/helpers/wit-sync-io.mjs
```

This check does not link the Wasmtime native import, execute a Lean call
through the component, or install a distributable WIT IO package. Those
are separate acceptance steps; the public CLI does not yet expose this
synchronous WIT IO route.
