# Downstream consumer performance, 12 August 2026

Status: all ten clean-consumer checks installed their documented package and executed real Lean through the generated public API.

## Measurement

The measurements ran after revision `7e20f740674b4c765d1dec26c5cc671b146ace07` on Linux x86-64 with an Intel Core i7-7700K at 4.20 GHz. Node consumers used Node 22.23.1. The consumer jobs wrote the structured performance records consumed by the downstream CI summary.

Nine consumers measured the same retained Lean `Box` read. Each process completed 10,000 warm-up calls before measuring 100,000 generated API calls. C and C++ used Release builds, and Rust used its release profile.

| Consumer | Timing mode | Iterations | Total measured duration | Result |
|---|---|---:|---:|---:|
| JavaScript on Node | steady state | 100,000 | 40,812,030 ns | 408.1 ns/call |
| TypeScript on Node | steady state after compilation | 100,000 | 39,898,490 ns | 399.0 ns/call |
| Browser JavaScript | steady state in Chromium | 100,000 | 35,300,000 ns | 353.0 ns/call |
| Native PHP | steady state through Zend | 100,000 | 25,962,226 ns | 259.6 ns/call |
| PHP-Wasm | steady state through the lazy transport | 100,000 | 194,104,645 ns | 1.94 µs/call |
| Python | steady state | 100,000 | 166,050,153 ns | 1.66 µs/call |
| Rust | steady state, release profile | 100,000 | 928,039 ns | 9.3 ns/call |
| C | steady state, Release | 100,000 | 547,426 ns | 5.5 ns/call |
| C++ | steady state, Release | 100,000 | 593,734 ns | 5.9 ns/call |
| WIT/WASI | whole invocation | 20 | 173,220,165 ns | 8.66 ms/invocation |

WIT/WASI measures an installed Wasmtime host process plus component startup and one real Lean call. It is intentionally reported as a whole invocation and is not comparable to the nine warm-call rows.

## Interpretation

These results measure the public API that an application receives after installing the generated package. The checksum in every steady-state consumer confirms that all measured calls executed and returned the retained value. TypeScript compiles to the same Node runtime path as JavaScript, so the small difference between those two rows is measurement variation rather than a distinct runtime cost.

This is one observational run on one machine. It does not provide a confidence interval, isolate host scheduling noise, or predict another processor. The downstream workflow records operation, timing mode, iteration count, total duration, platform, architecture, and CPU in its JSON report so unlike scopes or workers remain visible.

The executable sources are [`tests/consumer-node.test.mjs`](../../tests/consumer-node.test.mjs), [`scripts/test-browser-package-consumer.mjs`](../../scripts/test-browser-package-consumer.mjs), [`scripts/test-native-consumers.mjs`](../../scripts/test-native-consumers.mjs), [`scripts/test-php-native-package-consumer.mjs`](../../scripts/test-php-native-package-consumer.mjs), [`scripts/test-php-wasm-package-host.mjs`](../../scripts/test-php-wasm-package-host.mjs), and [`scripts/test-wasi-consumer.mjs`](../../scripts/test-wasi-consumer.mjs). The dedicated [consumer workflow](../../.github/workflows/consumer-matrix.yml) publishes the same fields in its GitHub job summary.
