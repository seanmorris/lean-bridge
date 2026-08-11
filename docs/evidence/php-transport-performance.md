# PHP Transport Performance Baseline

Status: measured POC evidence for the generated PHP API through native Zend, lazy PHP-Wasm, and startup PHP-Wasm. These results describe one machine and one fixture.

Date: 2026-08-09 UTC.

## Environment and method

| Property | Value |
|---|---|
| operating system | Linux 6.1.0-31-amd64 |
| architecture | x86-64 |
| processor | Intel Core i7-7700K at 4.20 GHz |
| logical CPUs | 8 |
| Node | 22.23.1 |
| PHP API | generated `LeanAlpha` and `LeanBeta` classes and functions |

The native startup sample launches PHP CLI, loads the extension, and loads the Composer package. The PHP-Wasm sample creates a PhpNode module and executes its first request. Those startup paths measure normal deployment behavior, but they perform different host work.

Each in-process profile warms 1,000 object lifecycles, performs 20,000 reads, invokes 3,000 callbacks, crosses 2,000 copied records, and creates and closes 3,000 retained objects. The benchmark calls generated PHP functions and classes. It does not call a dispatcher, `ccall`, `cwrap`, or numeric handle API.

## Results

| Profile | Startup median | First Alpha call | First Beta call | Warm read | Callback | Copied records | Cleanup | Package bytes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| native Zend | 11.717 ms | 2,154.419 µs | n/a | 179.5 ns | 398.2 ns | 580,685 calls/s | 3.397 µs | 14,292,674 |
| PHP-Wasm lazy | 529.163 ms | 54,756.934 µs | 25,716.393 µs | 1,728.4 ns | 5,944.3 ns | 43,129 calls/s | 19.112 µs | 9,217,044 |
| PHP-Wasm startup | 377.152 ms | 8,169.042 µs | 415.746 µs | 1,579.7 ns | 4,810.8 ns | 46,496 calls/s | 17.155 µs | 9,212,868 |

The first Alpha call includes deferred Lean runtime and component initialization. The lazy profile's first Beta call loads `beta.so.wasm` into the existing PHP-Wasm memory and table, initializes Beta, reads the retained Alpha object, and returns its canonical PHP wrapper. The startup profile loads Beta's binary during module startup, so its first Beta call only performs component initialization and the generated calls.

The copied record crosses `Bool`, `UInt32`, `String`, `ByteArray`, and `Array UInt32` through the generated typed frame. The fixture carries 29 logical payload bytes per call. The benchmark reports calls per second because the logical byte count excludes frame headers and host wrapper allocation.

## Memory and cleanup

Native PHP reported a 2,097,152-byte peak PHP allocation and a 27,452 KiB process peak RSS. PHP-Wasm allocated one 134,217,728-byte linear memory for each PhpNode instance. Its PHP memory functions returned zero under this host, so the report does not treat those counters as measurements. Node RSS is recorded as a process total after three live PhpNode instances and is not a per-instance allocation figure.

All three profiles ended with zero live retained identities. Native Zend initialized one component. Each PHP-Wasm profile initialized Alpha and Beta while keeping one runtime initialization.

## Reproduce

Run:

```sh
npm run benchmark:php
```

The command builds fresh packages and writes raw values, sample summaries, runtime counters, memory observations, package sizes, environment details, and limitations to `build/php-performance/performance.json`. Timing data remains outside release artifacts, so machine variance cannot affect the reproducibility gate.
