# Shared C and C++ corpus, 2026-09-17

VO 1217. The shared corpus adds prepared-package C11 and C++20 consumers for `Shop.Pricing` and `Telemetry.Readings`. Both use the same independent input catalog and fresh Lean oracles as the other nine adapters. Production generators and the type-support inventory are unchanged. The [ordinary C/C++ tests](../../tests/native-c-copied.test.mjs) retain their separate allocation-failure, threading and broader copied-value checks.

## Public calls and host policies

Each library exports 19 public functions. Independent `_Generic` assertions in C and `std::is_same_v` assertions in C++ check complete function types: fixed-width scalars, borrowed aggregate inputs, owned results, record types, unit conventions and the C status/error outputs. The callers use only installed public headers and APIs.

The shared catalog has 124 cases across both libraries. C executes 94 and rejects 30 at compile time; C++ executes 92 and rejects 32. Every executed result must match the fresh Lean oracle. Tests cover all sixteen primitive parameter/result types, Unicode and embedded NUL, bytes, nested arrays and copied records. `Nat` and `Int` values exceed 4,096 bits. Float results compare exact bits except for NaN classification.

Both languages accept boolean-to-integer, integer-to-boolean and integer-to-float conversions for these inputs. C also accepts the zero-valued unit marker in a `uint32_t` array. C++ rejects its `std::monostate` counterpart. The catalog records these policies explicitly, and Lean computes the corresponding accepted results.

Invalid fixed-width values use fatal GCC conversion warnings in C and list-initialization narrowing checks in C++. These compiler settings prevent the test program from silently truncating its input; they are not dynamic range checks by the C ABI. Other invalid programs pass signed `Int` storage to a `Nat` parameter, place it in a `Nat` record field, or pass the wrong aggregate type.

Each rejected input gets a separate source file and syntax-only compile. The harness requires exit status 1, complete GCC JSON errors in that input file, and the expected narrowing or incompatible-type diagnostic. A missing header, failed link or unrelated compiler error cannot count as rejection evidence. Reports bind each program to its input with a source hash. Rejected programs do not contribute to runtime coverage.

The public C/C++ APIs currently represent `Nat` and `Int` as little-endian 32-bit limbs. This milestone tests that representation. The planned GMP and Boost representation changes remain in VO 1218.

## Ownership and runtime errors

Record calls must leave borrowed inputs unchanged. After a call, the consumer mutates the input's nested rows, text and big integers; the result must remain unchanged. C++ also mutates the owned result and checks that the input remains unchanged. Row mutations include empty rows. C wraps each aggregate result's public release callback, requires exactly one invocation on clear, and verifies that a second clear is harmless. Clearing a copied C record must not affect its borrowed input.

Both profiles reject malformed UTF-8, oversized strings and malformed UTF-8 inside a copied record. C also rejects null nonempty spans, a null output pointer, an invalid unit marker and a null nested span. Each case runs three times, and a valid public call after every failure must match Lean. These 60 supplemental rejection/recovery observations appear as `cFamilyRuntimeRejections`, separately from catalog cases and compiler rejections.

## Prepared packages and relocation

The two libraries have different APIs, layouts and calculations, local and pinned offline Git dependencies, and three proved lemmas each. The author harness checks compiler declarations against the independent catalog and reproduces every archive from a relocated source tree. It removes the Lean/oracle/build trees before verifying the relocated handoff through the public CLI and installing the prepared archives.

Each installation compiles two callers: one uses the installed pkg-config file, and one uses `find_package` with the prepared CMake imported target. The only compiled source is the downstream caller. The compiler environment has no Lean path or runtime override; its private search path contains only the assembler and linker.

The harness moves both executables and the packaged shared libraries to a new deployment. It deletes the installed headers, package metadata, consumer sources and both build trees before execution. `ldd` must resolve every packaged library inside that deployment. Each executable runs twice with compiler paths and runtime overrides disabled. All four observations must agree, and deployed library hashes must remain unchanged.

Reports record compiler and macro identities, exact public signatures, caller/header hashes, source-located rejection diagnostics, pkg-config and CMake configuration hashes, both executable hashes, and each deployed library's identity. Build integrations and repeated executions do not multiply coverage counts.

After validating all consumers for one library and transport, the harness rechecks its handoff receipt and removes the consumer directory. Failure hooks still remove incomplete runs. The first eleven-profile run exposed the need for this earlier cleanup: retained installations left less than the required 3 GiB before the second library's npm build. The free-space guard remains unchanged.

## Local results

The final C/C++ suite passes all 130 tests in 215.2 seconds. Eight archive builds reproduce, four installed consumers execute 186 differential cases, and 62 invalid programs fail with the expected compiler diagnostics. The 60 additional runtime rejection/recovery checks pass. The report records 82 scoped observed cells and 6,480 gaps.

The run used GCC/G++ 12.2.0, CMake 3.25.1, pkg-config 1.8.1, Node 22.23.2 and Lean 4.32.2 (`f3b06c705e6c85f5314019d5d3baab0fec5b580c`) on x86-64 Debian 12. The local glibc floor override was 2.36; production and CI retain 2.38. Nix is unavailable locally, so these results do not claim local execution of the Nix-pinned engine.

At commit `b93fc93`, the catalog and 32 source/harness files bind corpus identity `7ed70abd0e85eacd86ceed123bbe3f5eead9ae1adde27df42ff6c93836e22f1c`. The report, `build/type-corpus/c-cpp.json`, revalidated against that identity and that revision's coverage rules.

| Prepared archive | SHA-256 |
| --- | --- |
| `shop-corpus-1.0.0-c.tar.gz` | `3ebb2d5d407976037bb2bac513c0809bb9e8331acf36cff8386c2461160b3e9d` |
| `shop-corpus-1.0.0-cpp.tar.gz` | `b6590c2348967c283241639a1f9cefb433e70f2f836a3ed03e7073c7412665ac` |
| `telemetry-corpus-1.0.0-c.tar.gz` | `1a576f76b5a53640b7331d67bd390fac5c0c8c4d5356245fc757d236593ca080` |
| `telemetry-corpus-1.0.0-cpp.tar.gz` | `449f9900f68f7452337dad7a1c1e0d7b10efc50069fb5e29166701b22700ed62` |

All four archives carry native runtime identity `e7d08d91baf7f70d791a79bd611779d311201ce6b6530f478be4f8ff1113be1f`. Reproducibility compares relocated builds with the same target selection. Combined-profile builds can have different package hashes because their captured export configuration selects additional targets.

The combined eleven-profile regression passes all 130 tests in 691.2 seconds. Its 22 library/profile installations record 1,364 catalog cases: 1,202 executed, 102 rejected at compile time and 60 unsupported. The 60 supplemental C/C++ runtime rejection/recovery checks and six Rust limit/recovery checks also pass. The report records 406 scoped observed cells and 6,156 gaps.

The browser portion records 24 engine/variant executions, with 1,344 executed cases and 144 unsupported records. It uses Chromium 151.0.7922.34, Firefox 153.0 and WebKit 26.5. Native hosts include Python 3.11.2, Ruby 3.3.12, Perl 5.38.2 threaded and Rust 1.90.0. Native and Perl glibc floor overrides are both 2.36. All profiles agree with the same fresh Lean results; native and WASM runtime/IR identities remain separate.

The combined report is `build/type-corpus/browser-javascript-browser-react-browser-worker-c-cpp-node-javascript-node-typescript-perl-python-ruby-rust.json`. Both final reports revalidate against the same corpus identity and coverage rules. The harness removed its temporary consumer and build directories after execution.

Core checks pass lint, checked-JavaScript types and 838 tests, with 54 compiler/runtime-gated skips. All 65 documentation tests, 111 site/demo tests, the site typecheck, production site build and type-inventory check pass.

## CI and remaining work

The native consumer job requires both the existing ordinary C/C++ suites and `npm run test:type-corpus:c-family`. It uploads `type-corpus-c-family-<commit>` from `build/type-corpus/c-cpp.json`; a failed run or missing report fails the gate. Individual `test:type-corpus:c` and `test:type-corpus:cpp` commands are also available. `test:type-corpus:all-native` includes all six native adapters. The [testing guide](../contributing/testing.md#shared-real-lean-type-corpus) lists prerequisites.

At this milestone, eleven of the seventeen shared-corpus adapters were implemented. .NET, Java, Kotlin, PHP native, PHP-WASM and WIT/WASI remained, along with reviewed-IR execution and the remaining type families, positions and semantics. Synthetic validator observations never become installed evidence. This milestone does not promote the 656 installed-tested inventory cells or publish a registry package.
