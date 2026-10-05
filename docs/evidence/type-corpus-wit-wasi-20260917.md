# Shared WIT/WASI corpus, 2026-09-17

VO 1217. The shared `Shop.Pricing` and `Telemetry.Readings` libraries execute through prepared WIT/WASI packages and the public Wasmtime C session API. This supplies the seventeenth ordinary-source corpus adapter. Production generators and the type-support inventory are unchanged.

## Executed package profile

This profile calls a Component Model component backed by the packaged native Lean runtime. The archive includes Wasmtime 42.0.1 and its public C headers. The component requires that native host; it is not a standalone WASI command.

Each independent library exports 19 functions, imports local and pinned offline Git dependencies, and contains three proved lemmas. Fresh Lean runs provide the expected results. The C caller receives only catalog inputs and independent type definitions, not oracle outputs.

Both libraries are built twice from relocated author trees. Their archive bytes must reproduce. Compiler-owned declarations must match the independent catalog. The separate pending `Option` and `Except` exports typecheck in Lean but must fail native source admission with the expected diagnostic and no output package.

The harness removes author and oracle directories before verifying and installing the prepared archive. It compiles only the downstream C11 caller, using the installed public Wasmtime header and pkg-config file. Parsed WIT source and binary component interfaces must match the catalog's function names, parameter order, result types, record field order and nested shapes. The WIT world must import the native interface and export the public interface.

The first all-adapter regression exposed a scratch-space peak: both native release trees remained while the harness copied the consumer handoff. That run was stopped and its temporary consumer removed. The harness now removes the duplicate release after verifying reproduction, before preparing the handoff. Archive comparison and declaration checks still finish before deletion.

The executable and packaged shared libraries move to a separate deployment. The installation and consumer build trees are deleted. Each library runs twice with compiler paths and runtime overrides disabled. The process reports its loaded shared-library paths; the harness checks their local paths and hashes against the installed receipt. Repeated observations and deployed bytes must remain unchanged.

## Values, rejection and ownership

The catalog covers all 16 primitive parameter/result types, nested arrays and copied records. Exact integers exceed 4,096 bits. `Nat` uses canonical little-endian `u32` limbs; `Int` adds its sign field. Unit is the single-case `unit` enum. Strings retain UTF-8 and embedded NULs. Float checks compare exact finite, infinity and signed-zero bits, and NaN classification.

Fixed-width Wasmtime C fields cannot represent out-of-range values. Those corpus literals must fail GCC compilation with fatal conversion warnings and a range diagnostic at the consumer source location. The report counts them as compiler rejections, not runtime range checks. Wrong tags and negative values presented to `Nat` produce runtime validation errors.

Supplemental checks reject non-canonical limbs, negative zero, invalid unit cases, malformed UTF-8, incorrect record field names, wrong scalar tags, missing exports, wrong arity and missing call arguments, results or sessions. A valid oversized list exceeds the Wasmtime conversion budget. A separate valid string crosses the native combined input/output budget and traps inside the Component Model call. Every check runs three times, preserves the output sentinel and is followed by a successful call compared with Lean.

Record tests require disjoint input/result and result/result allocations. They mutate and delete inputs and one result, then close the session. The remaining result must retain its original nested values and remain usable without that session.

## Evidence validation

The report binds the exact archive, package receipt, native component/adapter/runtime receipts, pinned Wasmtime file inventory, compiler and parser identities, parsed declarations, public caller and executable. Checked-in Wasmtime metadata contains file sizes and SHA-256 digests, not SDK binaries.

The new validator tests reject changed receipts, headers, engine payloads, interface signatures, nested fields, enum cases, world wiring, cyclic type aliases, compiler diagnostics, local library paths, error messages, ownership claims and recovery results. Synthetic fixtures exercise these validators only. The enabled compiler test alone writes installed-execution reports.

## Validation

The final standalone command passes all 411 tests in 160.5 seconds. Its 124 catalog cases contain 100 executed cases and 24 compiler rejections. The report separately records 84 supplemental error/recovery observations. Each installed executable runs twice; repeats do not add coverage.

The report records 41 scoped observed cells and 6,521 gaps. It is written to `build/type-corpus/wit-wasi.json` and revalidates against the catalog plus 56 input files, with corpus identity `0448a59b9843db43ce3484a3ca7907ccec1b715f947910d87aca514dee20f207`.

Recorded tools: Lean 4.32.2, GCC 12.2.0, Wasmtime 42.0.1, wasm-tools 1.245.1 and Node 22.23.2. Native execution uses this machine's explicit glibc 2.36 test override; the production and CI floor remains 2.38.

| Prepared artifact | SHA-256 |
| --- | --- |
| Shop WIT/WASI archive, standalone | `9ab73fff9642b84804dd5fc5157cb2c23e192e356fdd177bc9449c15becf9905` |
| Telemetry WIT/WASI archive, standalone | `1c122f770c8c04f0fc81c689c2ffafb4f25f929aaa61144451a66e7b42b1e180` |
| Shop WIT/WASI archive, combined | `23a8aa082cdf34efaccdaf069907b9744aa79ad1d4612176f745e4556c8099f9` |
| Telemetry WIT/WASI archive, combined | `67ad3bca84dc15feecc1fed3f9a9a09882922efc56543347082df81a79c34740` |
| Shared native runtime identity | `e7d08d91baf7f70d791a79bd611779d311201ce6b6530f478be4f8ff1113be1f` |

Core checks pass with 1,119 tests and 54 toolchain-gated skips. Documentation tests pass 65/65, site/demo tests pass 111/111, and site type checking and the production build pass. The type-support inventory remains at 656 installed-tested cells and 29,530 required gaps.

## Combined regression

The seventeen-adapter run passes all 411 tests in 1,376.4 seconds. Its 34 library/profile installations record 2,108 catalog cases: 1,846 executed, 202 rejected at compile time and 60 explicitly unsupported. It records 652 scoped observed cells and 5,910 gaps.

Supplemental error/recovery checks pass: 84 WIT, 1,728 PHP-Wasm, 264 native PHP, 144 JVM, 60 .NET, 60 C/C++ and six Rust observations. The npm browser adapters record 24 engine/variant observations containing 1,344 executed and 144 unsupported cases. PHP-Wasm separately records 24 route/caller observations containing 1,488 catalog executions. Repeat runs do not add coverage.

The combined report is `build/type-corpus/browser-javascript-browser-react-browser-worker-c-cpp-dotnet-java-kotlin-node-javascript-node-typescript-perl-php-native-php-wasm-python-ruby-rust-wit-wasi.json`. Both reports revalidate against the same corpus identity.

The standalone and combined WIT archives have different provenance: the export configuration lists one target in the standalone build and ten in the combined native build. That changes the source snapshot, binding IR and receipt hashes. The compiled shared libraries, WIT source, component binary, public signatures, Lean module sources, native runtime and oracle results match across both runs. Each configuration independently reproduces its archive bytes.

All completed and stopped-run corpus scratch directories were removed. Available space returned to 5.3 GiB; user files and the running development server were preserved.

## CI and remaining work

The WIT consumer job requires `npm run test:type-corpus:wit-wasi` and uploads `type-corpus-wit-wasi-<commit>`. A failed run or missing report fails the consumer gate. The [testing guide](../contributing/testing.md#shared-real-lean-type-corpus) lists the tools and selectors.

All 17 ordinary-source adapters are implemented. Reviewed-IR execution and further type families, positions and semantics remain open. VO 1217 remains in progress. Scoped corpus observations do not promote the separate type-support inventory or publish a registry package.
