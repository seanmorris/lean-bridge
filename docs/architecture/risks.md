# Technical Risk Register

Scores are provisional before the POC. `L` is likelihood and `I` is impact on a low/medium/high scale.

| Risk | L | I | Early mitigation or falsification |
|---|---|---|---|
| Full Lean runtime cannot link cleanly as an Emscripten main module with runtime-free side libraries | M | H | First spike builds main + two sides, audits symbol ownership, init, memory/table, and repeat calls before API work. |
| Side-module symbols retained too broadly or omitted under DCE | H | H | Compare `MAIN_MODULE=2`, explicit export/import manifests, load-time and lazy paths; store nm/wasm-tools reports. |
| Lean runtime/version mismatch between capsule and main module | M | H | Exact ABI/toolchain/build hashes and compatibility ranges; reject before loading. |
| Duplicate module initialization or inconsistent builtin flags | M | H | Generated DAG, idempotent registration, one owning agent, counters and duplicate-load tests. |
| Lean RC root leak, double release, or use-after-free | H | H | Generated borrow/lease operations, cleanup ledger, generation tokens, sentinels, 100k-cycle stress, shutdown audit. |
| JS GC↔Lean RC cycle remains live | H | M | Document no automatic cycle collection; explicit owner/cut APIs; cycle diagnostics and tests. |
| `FinalizationRegistry` timing is mistaken for correctness | M | H | Explicit disposal/scopes are authoritative; forced GC tests are supplemental only. |
| Callback signature/table mismatch | M | H | Generated finite signature IDs/adapters; table import/export audit; wrong-signature negative tests. |
| Nested re-entry corrupts arenas or ownership frames | M | H | Per-call frame/arena stack, depth budgets, same-agent rule, nested success/throw/dispose stress. |
| Promise cancellation, late settlement, or shutdown completes twice | H | H | Explicit pending state machine, call IDs, exactly-once assertions, adversarial timing suite. |
| Cross-agent/thread semantics are unsafe or require COOP/COEP | M | M | Stackless same-agent baseline; worker communication async; threads a later explicit profile. |
| Dynamic loading causes unacceptable startup/download/relocation overhead | M | H | 1/3/10/50 profiles, cached/cold stages, static-final comparison, lazy capability loading. |
| Bundlers fail to discover or relocate side-module assets | M | H | Literal `new URL` descriptors, locator override, raw ESM/Vite/Rollup/Webpack fixtures, PHP-Wasm pattern reuse. |
| Resolver graph differs from static/Nix graph | M | H | One canonical lock/library IDs; graph/schema hashes compared before execution and in CI. |
| Nix build is not bit reproducible because tools embed nondeterminism | M | H | Clean builds, normalized paths/timestamps/order, binary diff evidence; do not overclaim Nix guarantees. |
| Proof metadata describes source but not shipped wrapper/binary | M | H | End-to-end identity chain from declaration/theorems through generator/ABI/lock to artifact hashes. |
| Assurance wording overclaims compiler/runtime/browser correctness | M | H | Three-state proved/trusted-boundary/unverified graph and named assumptions in generated docs. |
| Type generation cannot represent dependent/higher-order declarations | H | M | Explicit export subset/adapters; generator diagnostics; checked manifest fallback, never public `any`. |
| Host-neutral schema weakens JavaScript object semantics | M | M | Separate portable types from JS capability types; WIT projection is a test, not a lowest-common-denominator mandate. |
| Unsafe dynamic/global host access expands attack surface | M | H | Capability-first safe API, decoder budgets, explicit unsafe escape hatch, integrity-checked descriptors. |
| Private runtime sneaks into a convenience dependency | M | H | Capsule symbol audit, package export policy, runtime-count tests, standalone entries excluded from resolver. |
| Existing `/app` workspace content is overwritten | L | H | Create only named new paths, preserve dirty repositories, stop on path conflict, never treat root as disposable. |

No risk may be closed by documentation alone when the POC can measure it. Passing runtime tests are evidence, not machine-checked proof.
