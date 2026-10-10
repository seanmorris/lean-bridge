# WIT Fin container edge instrumentation

The source control runs the complete original-plus-edge Wasmtime C consumer against actual compiled Lean and a production-generated Component Model host. It preserves all 14,066 assertions and records 12,038 public calls, including 6,000 rejection/recovery pairs. Each measured call retains the original borrowed input and owned result or error. Existing value, diagnostic, ownership, unchanged-input and recovery assertions remain intact.

Calls pass through the generated host and embedded Component Model binary to the native Lean implementation. The caller-local wrapper measures six typed adapters and the non-inlined `present` and `flatten` source functions. Four inlined identity source functions remain unmeasured. The observer checks all eight counters after each call, including rejection paths, and requires the complete ordered transcript. Final counters are `[1003, 1003, 1001, 1001, 1001, 1003, 1003, 1003]`.

WIT represents Nat with unsigned limbs, so negative Nat values cannot be represented by these public values. The raw foreign-carrier validation gates remain separate; this observer does not attribute another host's malformed-carrier checks to WIT.

## Package and loaded-definition checks

The fixture compiles the original Lean declarations, generated adapters, C bindings and Wasmtime host, using the pinned Wasmtime 42.0.1 C API and wasm-tools 1.245.1. The host's normal dependency checks are unchanged. It includes the compiled Component Model binary and loads origin-relative native libraries.

The test installs a synthetic receipt-bearing archive through the normal consumer harness, moves the complete installation, and calls `repeatFinContainerEdges` with dispatch measurement enabled. This exercises both its separate raw-adapter observer and the new public-WIT observer. The installed package, headers, component digest, native libraries and external probe files are authenticated before and after compilation/execution. Startup checks authenticate the loaded public host, engine and C wire definitions. The interposer checks the libraries defining each native entry.

Two fresh processes repeat the complete public transcript. Refusal controls cover missing instrumentation, missing source/adapter increments, extra increments, nonzero initial counts, foreign public/native definitions, an incorrect model, a probe inside the package, changed host bytes, and missing or mismatched component/Wasmtime metadata. No installed library or generated host implementation is rewritten for observation.

## Verification and remaining acceptance

```sh
LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST=1 \
node --test --test-concurrency=1 tests/fin-container-edge-wit.test.mjs
```

All three tests passed with zero failures or skips in 91.056 seconds. Original TAP: `/app/build/vo1454-wit-observer-r2.tap`, SHA-256 `4e91b73ff16e1b1f0b070cff544185c0e2772c623cfdfe5be17691739b9fa315`. Observed stdout SHA-256: `8da8e84e8731aba98a8ffae72fa2b48032caf27263181e0225bb3ac94886ee34`. Focused lint and checked JavaScript passed.

This completes implementation of the public observers for the native container-edge profiles on the isolated branch. These source controls use synthetic receipts, not fresh extractor metadata or canonical two-root packages. Integration with the current indexed diagnostics, immutable source-history reconciliation, the full canonical installed matrix, hosted acceptance and the remaining scope audit still need completion. No support-table claim changes.
