# Running synchronous Lean IO through Wasmtime

Three Linux x86-64 C consumers called the [checked WIT worlds](wit-sync-io-world-20261123.md)
through Wasmtime 42.0.1. Each executable linked against a prepared include/lib
directory, then ran after both that directory and the producer build had moved.
Its only configured library search path was relative to the executable. Its
runtime environment contained no Lean, compiler, or build-tool paths.

| Consumer | Checks | Native host SHA-256 |
| --- | ---: | --- |
| Journal: state and filesystem | 27 | `da6694a6536c7fd02a90959463133530a2aacc0cad13c194a8fdd7170d8cd9b0` |
| Ledger: state and typed failures | 24 | `617087f3bad80396cb3f4c64c1325cdd74619e0e17dbc810554c47ba25bfa39b` |
| Journal with all 19 scalar types and nested `EIO` | 85 | `2cb103f126f14b47e584bb9033398b230fe9fdbeb5813bec2654ab063c4ab88f` |

Journal wrote and read UTF-8 containing an embedded NUL and returned an
`IO.Error` for a missing file. All three consumers distinguished throwing an
`Except` from returning one, rejected an invalid argument before mutation,
and kept a returned value alive after closing its session. A forked child
could not reuse the inherited session. Substituting different bytes under
the broker's original library name prevented Ledger from opening.

Six additional processes exercised failure handling across two sessions
each. Each ran the real Lean operation once. Only the test executable
intercepts the native reply; the production library has no fault selector.

| Observation | Shared runtime after the call |
| --- | --- |
| Synchronous export reported pending | Retired |
| Native conversion-limit status | Usable |
| Nonzero unused result tag | Retired |
| Valid byte sequence too large to copy into Wasmtime values | Usable |
| Invalid UTF-8 in an owned native result | Retired |
| Guest executed `unreachable` after the Lean state update | Retired; no replay |

The caller's output slot stayed unchanged on every failure. After each case
the observer found no outstanding tracked buffer or live broker identity.
These checks at `4d15ac5` cover the generated session API, not arbitrary
components run on a caller-owned store. A raw linker cannot observe traps
that happen after its import returns. The [package workflow](../consume/wit-wasi.md#call-synchronous-io)
also supplies a guarded entry for caller-owned stores.

## Reproduce

Set `LEAN_BRIDGE_LEAN_PREFIX` (Lean 4.32.2), `LEAN_BRIDGE_WASM_TOOLS`
(the wasm-tools 1.245.1 executable), `LEAN_BRIDGE_WASMTIME_C_API` (the pinned
Wasmtime C SDK), and `LEAN_BRIDGE_WIT_IO_RUNTIME` (a verified native runtime
for that Lean build). From the repository root, run:

```sh
npm run test:wit-sync-io
```

The [test driver](../../tests/helpers/wit-sync-io.mjs) compiles the Lean
sources and checks each binary against its WIT world before linking the host.
The [relocation test](../../tests/helpers/wit-sync-io-install.mjs) uses native
shared libraries, not a standalone WASI command: `IO.FS` runs with the host
process's filesystem permissions. This host test does not install an archive.
The [archive acceptance](../../tests/helpers/wit-sync-io-package-flow.mjs)
exercises that separate workflow. Neither test exercises async delivery.
