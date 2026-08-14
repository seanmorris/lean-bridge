# WIT/WASI native host

[`native-component-host.c`](native-component-host.c) is the independent Wasmtime host used by the clean WIT/WASI consumer test. It loads the packaged component, enters the generated native boundary, and checks the expected Lean result.

WIT generation lives in [`../backends/wit`](../backends/wit/). WASI archive construction lives in [`../release/wasi-package.mjs`](../release/wasi-package.mjs).

See the [WIT projection evidence](../../docs/evidence/wit-projection.md) and [WIT/WASI consumer acceptance](../../docs/evidence/wasi-consumer-acceptance.md).
