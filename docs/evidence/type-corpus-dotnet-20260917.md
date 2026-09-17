# Shared .NET corpus, 2026-09-17

VO 1217. The shared corpus adds prepared NuGet consumers for `Shop.Pricing` and `Telemetry.Readings`. C# callers use the public generated API and the same input catalog and fresh Lean oracles as the other eleven adapters. Production generators and the type-support inventory are unchanged. The [ordinary .NET suite](../../tests/native-dotnet.test.mjs) retains its separate allocation-count, concurrency and multi-package checks.

## Public calls and host policies

Each library exports 19 functions. Independent C# calls and reflection checks require the exact public method parameter and return types. Record checks require the expected sealed type, constructor argument order, property types and init-only setters. These expectations come from the shared catalog, not the generated declarations.

`Nat` and `Int` use `System.Numerics.BigInteger`; the inputs exceed 4,096 bits. Arrays and records use copied managed storage. `Unit` parameters use `default(Unit)` and `Unit` results return `void`. Floating-point cases compare exact bits for finite values, signed zero, subnormals and infinities; NaN cases check classification.

C# accepts the catalog's integer-to-float conversions. Negative `Nat` arguments, including a negative record field, must throw `ArgumentOutOfRangeException` with the expected diagnostic. The next valid call must match Lean.

Wrong aggregate and boolean types, invalid nested elements and checked fixed-width overflows must fail compilation. Each invalid input gets a separate source file, compiled against the installed public assembly and .NET reference assemblies. The harness requires exit status 1 and a source-located Roslyn SARIF diagnostic with the expected error code. Missing dependencies and unrelated compiler failures cannot count as input rejection. Checked constant casts are a consumer compiler policy, not runtime range checks by the installed API.

## Ownership and runtime errors

Record calls must leave their input unchanged. Mutating the input's nested rows, including replacing an empty row, must not change the result. Mutating the result's rows must not change the input. Weak references verify that the input and returned managed records can be collected after the caller releases them. This does not measure native allocations or assembly unloading.

Supplemental runtime checks cover null strings, byte arrays, arrays, records and nested rows; malformed UTF-16 directly and inside a record; oversized bytes and strings; and a call that exceeds the combined native input/output budget. Each case runs three times. Every rejection must have the exact exception type, and the following valid call must match Lean. Reports count these checks separately from catalog and compiler-rejection cases.

## Prepared packages and isolation

Both libraries contain local and pinned offline Git dependencies and three proved lemmas. The harness checks compiler declarations against the independent catalog, builds each archive twice from relocated source trees, and compares archive hashes. It deletes the Lean, oracle and producer build trees before verifying the relocated handoff through the public CLI.

Each consumer gets a private NuGet feed, empty package cache and empty CLI home. Restore permits only the prepared package at its exact version, with no fallback package folders or other sources. The harness verifies the restored dependency graph and package content hash, then repeats restore in locked mode. NuGet removes ZIP container metadata during extraction; verification checks the retained original archive and every extracted payload file.

The C# build disables parent MSBuild props/targets and shared compiler servers. Its only package dependency is the prepared archive. Reports bind the SDK, Roslyn compiler, reference assemblies, public declarations, package receipt, compiled assembly, input programs, dependency graph and lock file.

Before execution, the harness relocates the compiled consumer and packaged libraries, then deletes the entire installation, feed, cache and consumer build tree. A separate runtime directory contains only the .NET host, hostfxr and selected framework. It has no SDK, Roslyn or reference assemblies. Both executions use that runtime with compiler paths and runtime overrides disabled. Loaded native libraries must resolve inside the relocated deployment. Both observations must agree, and deployment and runtime file hashes must remain unchanged.

## Local results

The .NET suite passes all 165 tests in 183.1 seconds. Four archive builds reproduce. Across the two installed packages, 88 positive catalog cases match fresh Lean, four negative `Nat` calls reject and recover, and 32 invalid programs fail with the expected compiler diagnostics. All 60 supplemental runtime error/recovery checks pass. The report records 41 scoped observed cells and 6,521 gaps.

The run used .NET SDK 8.0.424, runtime 8.0.30, Roslyn `4.11.0-3.25569.22 (3fb752d4)`, Node 22.23.2 and Lean 4.32.2 (`f3b06c705e6c85f5314019d5d3baab0fec5b580c`) on x86-64 Debian 12. The local glibc floor override was 2.36; production and CI retain 2.38. Nix is unavailable locally, so these results do not claim local execution of the Nix-pinned engine.

The catalog and 35 source/harness files bind corpus identity `c5260ed70dc521f273464103a1b5e96700724125f2fa07a33dc0168c3963ffce`. The standalone report is `build/type-corpus/dotnet.json`.

| Prepared archive | SHA-256 |
| --- | --- |
| `shop-corpus.1.0.0.nupkg` | `ac4524ff03532600b315f69520d4455aaaa785f4f5154d20361977b5c926ccad` |
| `telemetry-corpus.1.0.0.nupkg` | `1214f09e0fc36dda4da04813c73b12ae2a5c29bf80ca17443fa8714415d09595` |

Both archives carry native runtime identity `e7d08d91baf7f70d791a79bd611779d311201ce6b6530f478be4f8ff1113be1f`. Reproducibility compares relocated builds with the same target selection. Combined-profile builds can have different archive hashes because their captured export configuration selects additional targets.

The combined twelve-profile regression passes all 165 tests in 834.1 seconds. Its 24 library/profile installations record 1,488 catalog cases: 1,294 executed, 134 rejected at compile time and 60 unsupported. The 60 supplemental .NET error/recovery checks, 60 C/C++ checks and six Rust limit checks also pass. The report records 447 scoped observed cells and 6,115 gaps.

The browser portion records 24 engine/variant executions, with 1,344 executed cases and 144 unsupported records. It uses Chromium 151.0.7922.34, Firefox 153.0 and WebKit 26.5. Other native hosts are GCC/G++ 12.2.0, Python 3.11.2, Ruby 3.3.12, Perl 5.38.2 threaded and Rust 1.90.0. Native and Perl glibc floor overrides are both 2.36. All profiles agree with the same fresh Lean results; native and WASM runtime/IR identities remain separate.

The combined report is `build/type-corpus/browser-javascript-browser-react-browser-worker-c-cpp-dotnet-node-javascript-node-typescript-perl-python-ruby-rust.json`. Both reports revalidate against the same corpus identity and coverage rules. Temporary build and consumer directories were removed after execution.

Core checks pass lint, checked-JavaScript types and 873 tests, with 54 compiler/runtime-gated skips. All 65 documentation tests, 111 site/demo tests, the site typecheck, production site build and type-inventory check pass.

## CI and remaining work

The managed consumer job requires both the ordinary .NET suite and `npm run test:type-corpus:dotnet`. It uploads `type-corpus-dotnet-<commit>` from `build/type-corpus/dotnet.json`; a failed test or missing report fails the gate. `test:type-corpus:all-native` includes .NET alongside C, C++, Perl, Python, Ruby and Rust. The [testing guide](../contributing/testing.md#shared-real-lean-type-corpus) lists prerequisites and toolchain selectors.

Twelve of the seventeen shared-corpus adapters are implemented. Java, Kotlin, PHP native, PHP-WASM and WIT/WASI still need adapters. Reviewed-IR execution and the remaining type families, positions and semantics also remain. Synthetic validator observations never become installed evidence. This milestone does not promote the 656 installed-tested inventory cells or publish a registry package.
