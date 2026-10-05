# WIT/WASI consuming input ownership

VO 1219. The [execution receipt](wit-owned-transfers-20260930.json) records
ordinary-source and reviewed-IR builds of the same 26 Lean exports, including
20 consuming exports. It follows the immutable
[JavaScript/TypeScript transfer receipt](owned-javascript-transfers-20260930.json).

## Behavior

Consuming public C parameters take their original result-owner slots. Their WIT
resource leaves use `own`; non-consuming resource parameters retain `borrow`.
Calls cross the generated Component Model binary and its native Lean imports.
The native adapter checks owner membership and all argument values before an
atomic handoff. It invalidates every consuming owner before Lean can invoke a
host callback. Failure before handoff preserves the inputs. Failure afterward
does not restore them or publish a partial output.

Whole-owner consumption invalidates sibling leases. Independently retained
owners survive. Original copied storage remains alive internally until the
active call and callbacks finish. Each consuming argument requires a distinct
owner in the same session. These rules cover nested records, options, results,
products, arrays, Lists, aliases, variants, finite recursive values and returned
Lean closures.

The public C probe executes all 26 exports on both source paths. It checks
16,930 assertions per path, including 42 allocation failures before handoff and
69 afterward, with no remaining tracked allocations or native identities.
AddressSanitizer and UndefinedBehaviorSanitizer executions match the cold Lean
startup leak baseline. Separate probes reject a missing transfer frame without
consuming its owner and reject a malformed result after consumption.

Removing owner-slot invalidation, owner membership validation, source-payload
cleanup or Wasmtime store-lease cleanup makes the independent consumer fail.

## Installed packages

Both source paths install the original release offline after producer removal.
Each executes 522 public API checks through pkg-config and again through CMake
after relocation and deletion of the archive handoff. The reviewed build also
requests a C package from the same native Lean compilation. The documented
[consuming-input example](../consume/wit-wasi.md#consuming-inputs) compiles from
the page and prints `42` against each relocated installation.

The package verifier rejects 11 altered capability or generated-source cases
per path. Loader checks cover the component, both Lean runtime libraries,
Wasmtime and GMP, with local/global loading, compatible duplicate packages and
inherited or freshly loaded hosts after `fork`.

Reassembling archives from authenticated build artifacts reproduces their bytes.
This does not establish a separate clean rebuild. The receipt includes compiler
inputs, component binaries, source hashes, package inventories and exact edits
back to its predecessor. Earlier receipts and support claims remain unchanged.

## Reproduction

Install the pinned Lean compiler, Wasmtime C API and wasm-tools using the
[test setup](../contributing/testing.md). On the recorded glibc 2.36 host:

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-wit-transfers
node --test tests/wit-owned-transfer-evidence.test.mjs
```

CI runs the enabled five-test gate, requires zero failures and zero skips, and
preserves its log and four execution reports. The source-history checks reject
unknown changes, forged predecessor hashes and overlapping edit spans.

Owner-anchored borrowed results and Docker installed acceptance remain separate
work. The package does not expose caller-managed Wasmtime stores or run as a
standalone WASI command. This milestone does not publish a registry release or
promote the final cross-language support matrix.

## CI follow-up

Core CI for the preceding JS/TS commit found a missing
`owned-aggregate-transfers.mjs` module in the filtered Nix engine source and a
historical receipt check that compared its frozen file inventory with today's
expanded inventory. The source boundary now includes the transitive dependency;
the import probe rejects deletion of either transfer module. The historical
check authenticates and restores the boundary recorded by its own receipt.
No earlier receipt was rewritten.
