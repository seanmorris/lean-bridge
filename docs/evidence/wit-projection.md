# Host-neutral WIT projection probe

Status: verified interface projection. The probe emits valid WIT and composition metadata for Alpha's portable subset. It does not yet wrap the existing core Wasm modules as Component Model binaries.

## Command

```sh
npm run generate:wit -- --json
node --test tests/wit-backend.test.mjs
```

The generator writes `wit/lean-alpha.wit`, `binding-manifest.json`, and `python-consumer.json`. `wasm-tools component wit` parses the generated provider package and an independently generated consumer package. The test run used `wasm-tools 1.245.1`. Nix supplies `wasm-tools` from the locked flake input.

## Portable surface

| Binding IR declaration | WIT projection | Python projection |
|---|---|---|
| `lean:Alpha.box` | `box` resource constructor | `Box.__init__` |
| `lean:Alpha.Box.read` | borrowed resource method returning `result<u32, bridge-error>` | `Box.read` |
| `lean:Alpha.roundTrip` | `round-trip(payload) -> payload` | `round_trip` |

`Payload` remains a WIT record containing `bool`, `u32`, `string`, `list<u8>`, and `list<u32>`. The projection does not serialize the record. `Box` remains a nominal resource with owned construction and borrowed method receivers.

The WIT and Python records carry the exact Binding IR SHA-256 used by JavaScript. Running the WIT backend does not mutate the Binding IR or the generated JavaScript package. Assurance records retain their original IDs, states, subjects, theorem links, and assumptions.

## Explicitly deferred semantics

| Declaration | Reason |
|---|---|
| `bridge:Alpha.Box.identity` | The result is a receiver-anchored borrow. WIT borrows cover a call and cannot safely express that escaping result. |
| `lean:Alpha.withCallback` | WIT does not model a first-class host function as a value type. |
| `lean:Alpha.makeAdder` | WIT cannot return the first-class `Transform` closure as the same value contract. |

The backend also defers arbitrary-precision integers, open generics, host-specific capabilities, properties without an explicit method contract, and asynchronous delivery modes in this MVP profile. Every deferred declaration has a stable code and explanation in the manifest. The backend never narrows a type or substitutes a handle convention to make generation pass.

## Independent composition

The provider exports `poc:lean-alpha@0.0.0/types`. A separate consumer package imports `box` and `bridge-error` from that exact interface. The official WIT parser resolves the consumer's `box` alias to the provider's resource type ID. Composition checks also bind the provider component ID, Binding IR hash, WIT package version, interface name, resource ID, and borrow mode. Drift in any field rejects the graph before component wiring.

The design follows the official [WIT package and resource model](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md). WIT supplies typed cross-language composition and nominal resources. Lean Bridge adds theorem, assumption, ownership, graph-lock, and artifact identities beside that interface.

## Remaining implementation

The next WIT stage must lower the shared-runtime core module graph into a Component Model adapter while preserving one Lean runtime, memory, table, registry, and initialization domain. It must then execute the same provider and consumer contract through a WASI host. The current probe establishes the interface and metadata contract without claiming that binary adapter.
