# WIT projection and Component Model adapter

Status: supported in the pinned x86-64 Linux Wasmtime host profile.

## Portable projection

The generator emits valid WIT for Alpha's portable subset and binds it to the same Binding IR identity used by JavaScript, Python, and native packages.

| Binding IR declaration | WIT projection | Python projection |
|---|---|---|
| `lean:Alpha.box` | `box` resource constructor | `Box.__init__` |
| `lean:Alpha.Box.read` | borrowed resource method | `Box.read` |
| `lean:Alpha.roundTrip` | `round-trip(payload) -> payload` | `round_trip` |

`Payload` remains a record of `bool`, `u32`, `string`, `list<u8>`, and `list<u32>`. An independent WIT consumer resolves `box` to the provider's nominal resource identity. The backend explicitly defers callbacks, returned first-class callables, and receiver-anchored borrowed results because WIT does not preserve those value contracts.

## Executable adapter

The deterministic WIT/WASI archive adds a binary Component Model adapter. It imports `lean-read-box: func(value: u32) -> u32`, passes that function through canonical lowering into a core adapter, lifts the result, and exports `read-box`.

The independent host uses the pinned Wasmtime C API 42.0.1. Its imported function constructs and reads a real Lean `Box` through the generated C API. The value returns through the component call. The archive includes the component, generated WIT, host executable, Wasmtime library, native Lean libraries, and canonical release metadata.

Run:

```sh
npm run generate:wit -- --json
node --test tests/wit-backend.test.mjs
npm run test:consumer:wasi
```

wasm-tools validates both the WIT documents and packaged Component Model binary. [WIT and WASI consumer acceptance](wasi-consumer-acceptance.md) records the installed execution path.
