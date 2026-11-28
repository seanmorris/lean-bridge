# WIT synchronous cursors in Wasmtime

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

## What the installed consumer observes

The [package test](../../tests/helpers/wit-immediate-package.mjs) builds an ordinary
Lean project and a separate project selected by a reviewed Binding IR. For
each it verifies the receipt, moves the archive out of the handoff, removes
the source and handoff, then extracts and relocates the installation. The
[consumer](../../tests/fixtures/wit-sync-io/cursor.c) compiles against the
installed header and `pkg-config` entry and executes with no tools on its PATH.

| Route | Verified package-set receipt (SHA-256) | Installed archive (SHA-256) |
| --- | --- | --- |
| Ordinary Lean source | `355becd81087471f85ea643c16f95d455617983e610c4ae4f0e75f3bda8e9a0b` | `8b720888685ddce4736c5dd19ca25757d7614804661893349e3f35f824336b62` |
| Independently reviewed interface | `a7fe6765226bca47cf681a48746aa7ea4ed6af2dca732bfe313ece1bc10e37e4` | `a1fc10c37503a24c9ca50d67d1a474d46e6fe7306f68a32a77116cc7df51f52b` |

It runs once with the packaged store and again with an application-owned
store and linker. Each time the Lean counters reach **six opens, eight pulls
and six closes**. The checks distinguish a failed factory, a failed pull,
an ordinary item, a yielded unit, and exhaustion. Pulling again after
exhaustion does not re-enter Lean. An invalid cross-store or wrong-kind borrow
does not advance it either. Early drop and store-scope shutdown finalize live
cursors; the finalizer writes a file the parent process reads.

After the scope closes, a fresh instance using its old linker cannot open
another cursor. In a separate process, returning normally from `main` with
an abandoned cursor still writes the finalizer file. This does not cover a
process killed before it can run its exit handlers.

For the trap control, the test substitutes a separate world-conforming
component that traps **after** the native factory has opened a cursor.
The guarded call leaves the caller's output untouched. A previously usable
sibling session refuses further work. No finalizer file is written: retirement
permits releasing native ownership, not executing a new application effect.

Two publisher controls produced no handoff: removing the filesystem grant
identified the close declaration, `Dials.finish`, and selecting a scheduled
export alongside the immediate cursors was rejected.

These are local Wasmtime 42.0.1 Linux x86-64 results with the test glibc floor
set to 2.36. Run
`npm run test:wit-immediate-cursor` with the [WIT author tools](../publish/wit-wasi.md).
This is an immediate `Option` pull, not a task, pollable or canonical stream.
