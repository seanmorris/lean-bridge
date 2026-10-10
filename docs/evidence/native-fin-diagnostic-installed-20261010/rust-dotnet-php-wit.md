# Rust, .NET, native PHP and WIT diagnostic acceptance

Producer: `af1dcbf8fe5e96dada23948b545c063b3e251dcc`, the same frozen
checkout as the [earlier native diagnostic batches](../native-fin-diagnostic-installed-20261010.md).

| Public consumer | Ordinary checks | Reviewed checks |
| --- | ---: | ---: |
| Rust | 2,053 | 2,053 |
| .NET | 2,053 | 2,053 |
| Native PHP | 2,053 | 2,053 |
| WIT-WASI | 2,056 | 2,056 |

The [original TAP](rust-dotnet-php-wit.tap) records two passing installed
tests, no failures or skips, in 455.9 seconds. Each route built at two
independent author roots and reproduced the archive hashes. The harness
removed author/build roots before offline installation. Host tools compiled
the consumers; the consumer PATH excluded the Lean compiler.

The consumers require the complete nested Fin field, case, structural and
element-index diagnostics. Reports retain their source hashes, thirteen
refinement trees, package identities and source-removal facts. Dispatch was
not measured for these four profiles. These record tests do not exercise
the separate #1454 container-edge installation guards.

Selected runtimes were Rust 1.90.0, .NET SDK 8.0.424, native PHP 8.2.33,
and Wasmtime C API 42.0.1. Lean was 4.32.2. Both local glibc and the
explicitly configured package floor were 2.36, not the hosted 2.38 floor.

| Original artifact | SHA-256 |
| --- | --- |
| [Ordinary report](ordinary-rust-dotnet-php-wit.json) | `3a6f06099be9cf18dabf31d5d8dcd32c417ef256297f038cd553e40b76498192` |
| [Reviewed report](reviewed-rust-dotnet-php-wit.json) | `8814f551f0de26d0bc37f3a83819325e7b198f568d860fe16ef1988968a64bbc` |
| [TAP](rust-dotnet-php-wit.tap) | `384b1bbd737fe849e61cbe3cba91063dca02850b4421a0c59bd7d0f7e6f6fb00` |

The command selected both installed tests and ran them sequentially on CPU 3:

```sh
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36
export LEAN_BRIDGE_FIN_RECORD_PROFILES=rust,dotnet,php-native,wit-wasi
export LEAN_BRIDGE_REVIEWED_FIN_RECORD_PROFILES=rust,dotnet,php-native,wit-wasi
export LEAN_BRIDGE_FIN_RECORD_REPORT=/path/to/ordinary-rust-dotnet-php-wit.json
export LEAN_BRIDGE_REVIEWED_FIN_RECORD_REPORT=/path/to/reviewed-rust-dotnet-php-wit.json
taskset -c 3 node --test --test-concurrency=1 \
  --test-name-pattern='^(relocated source-free native packages check Fin inside record fields and the active variant case|independently reviewed native packages check record and variant field bounds after source-free installation)$' \
  tests/native-fin-records.test.mjs
```

The original report bytes are unchanged. The harness removed the binary
packages after testing; their digests and sizes remain in the reports.
This archive does not promote support or close #1442. PHP-Wasm, affected
callback/container gates, hosted verification and the full coverage audit
remain separate requirements.
