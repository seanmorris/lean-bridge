# Shared Rust corpus, 2026-09-17

VO 1217. The shared corpus adds an installed Cargo adapter for the same `Shop.Pricing` and `Telemetry.Readings` libraries used by Python, Ruby, Perl and the five npm profiles. Production generators and type-support claims are unchanged. The earlier [ordinary Rust acceptance](native-rust-20260915.md) retains its separate concurrency, injected-failure and runtime-composition checks.

## Typed calls and compiler rejections

The catalog contains 124 cases across the two libraries. Rust executes 84 positive cases covering all sixteen primitive parameter/result types, nested arrays and copied records. Each result must match a fresh Lean oracle. Floating-point observations compare exact bits except for NaN classification. Large `Nat` and `Int` inputs exceed 4,096 bits.

The caller checks all 19 public function types per library against independently specified signatures. Inputs use the expected borrowed types; results must be owned `Result<T, api::Error>` values. The caller imports the installed crate's public API and uses its re-exported `BigUint`, `BigInt` and record structs. It neither reads generated declarations to choose expected types nor calls raw FFI.

Rust's types prevent the other 40 inputs from compiling. Each invalid case gets its own consumer binary source and `cargo check` invocation. Unsigned negative literals require `E0600`, out-of-range integer literals require `overflowing_literals`, and incompatible input types require `E0308`. Negative `Nat` inputs use a signed `BigInt` where the API requires `BigUint`. Integer inputs to floating-point exports are also type errors in Rust.

The harness requires exit status 101 and complete JSON diagnostics that identify the offending consumer source, not a dependency or loader failure. Source hashes bind every rejected program to its catalog input. Compiler rejection is reported as `rejected-at-compile-time`; it contributes neither to `executedCases` nor runtime type-position coverage. The diagnostic collector retains bounded full output because truncating a Cargo error to its display tail can cut a JSON record in half.

## Ownership, limits and execution

Record calls must leave their borrowed inputs unchanged. The caller then mutates nested rows, text and big integers on each side and checks that the other record remains unchanged. Results sent back to the validator are the values observed before those mutations.

Each library also rejects an oversized string three times with the public `Error::Limit` variant. A valid public call after each rejection must match Lean. These six runtime limit/recovery checks are separate from the catalog's compiler-rejected inputs. They are reported as `rustRuntimeRejections`, not added to the 84 positive catalog cases.

The harness moves the compiled executable out of its build tree and deletes that tree, including crate sources, vendored dependencies, Cargo home and compiler outputs. It executes the moved binary twice with compiler and Cargo paths disabled. Both runs must return identical observations. Normal exit must leave no new Rust runtime loader assets or registry directories.

## Prepared Cargo installation

Both libraries have nested modules, local and pinned offline Git dependencies, and three proved lemmas. The producer checks fresh compiler declarations against the independent catalog, rebuilds each crate from a relocated source tree, and requires matching archive hashes. It verifies the copied package-set receipt through the public CLI after deleting the author/build trees.

The author-side dependency preparation fetches the complete pinned Cargo lock, including platform-conditional packages that a local compile check may not download. It vendors the closure offline and creates a deterministic dependency archive. Consumers receive only the prepared crate and this dependency handoff. They verify packaged file hashes, Cargo locks, vendor manifests and every dependency file checksum before compiling.

Consumer compilation uses an empty Cargo home, an isolated project and `--locked --offline`. Cargo metadata must resolve the public crate and every dependency inside that project. Lean and C compilation are unavailable. A link-only driver permits Rust's native linking step but rejects C/assembly source files and compilation modes. Reports identify rustc, Cargo, the dependency archive and packages, typed consumer sources, generated declarations, installed receipt, binding IR and executable.

## Local results

The Rust-only suite passes all 84 tests in 217.5 seconds. Four archive builds reproduce, two isolated consumers execute 84 positive cases, and 40 invalid-input programs fail with their expected compiler diagnostics. Six additional runtime limit/recovery checks pass. The report records 41 scoped observed cells and 6,521 gaps.

The run used Rust 1.90.0 (`1159e78c4`), Cargo 1.90.0 (`840b83a10`), Node 22.23.2 and Lean 4.32.2 (`f3b06c705e6c85f5314019d5d3baab0fec5b580c`) on x86-64 Debian 12. The local glibc floor override was 2.36; production and CI retain 2.38. Nix is unavailable locally, so these results do not claim local execution of the Nix-pinned engine.

The catalog and 28 source/harness files bind corpus identity `2a8e8d8fc9e7cc65eca825f7b0bf834dde1050296125762db4727d77bb602145`. The completed report, `build/type-corpus/rust.json`, revalidates against that identity and the current coverage rules.

| Rust-only prepared archive | SHA-256 |
| --- | --- |
| `shop-corpus-1.0.0.crate` | `7724833004d85d1837643a8e6a6fdc5681fd9bbe89e2379cecdbfcfed05d7292` |
| `telemetry-corpus-1.0.0.crate` | `b6c33bc41b85f9e37d2f7962ed1ef53b002349a8f0bbf9dcbf0a0dce317444c8` |
| Locked dependency archive, 14 packages | `48229987e373402555e4398ebc03073472b74d3f74e13f97c928af53e59be8dd` |

Both crates carry native runtime identity `e7d08d91baf7f70d791a79bd611779d311201ce6b6530f478be4f8ff1113be1f`. Reproducibility compares each pair of relocated builds with the same target selection. Combined-profile builds can have different package hashes because their captured export configuration selects additional targets.

The combined nine-profile regression passes all 84 tests in 607.8 seconds. Its 18 library/profile installations record 1,116 catalog cases: 1,016 executed, 40 rejected at compile time and 60 unsupported. The six supplemental Rust runtime limit/recovery checks also pass. The browser portion records 24 engine/variant executions, with 1,344 executed cases and 144 unsupported records; reruns do not multiply type-position coverage. The report contains 324 scoped observed cells and 6,238 gaps.

That run uses Python 3.11.2, Ruby 3.3.12, Perl 5.38.2 threaded, the same Rust/Node toolchains, Chromium 151.0.7922.34, Firefox 153.0 and WebKit 26.5. Native and Perl glibc floor overrides are both 2.36. All profiles match the same fresh Lean result set, while native and WASM runtime/IR identities remain separate. The report, `build/type-corpus/browser-javascript-browser-react-browser-worker-node-javascript-node-typescript-perl-python-ruby-rust.json`, revalidates against the same corpus identity as the Rust-only run. The harness removes its temporary workspaces after execution.

Core checks pass lint, checked-JavaScript types and 792 tests, with 54 compiler/runtime-gated skips. All 65 documentation tests, 111 site/demo tests, the site typecheck, production site build and type-inventory check pass. Synthetic validator tests do not count as installed corpus observations.

## CI and remaining work

The native consumer job requires `npm run test:type-corpus:rust` and uploads `type-corpus-rust-<commit>`. A failed run or missing report fails the Rust consumer gate. `npm run test:type-corpus:all-native` includes Python, Ruby, Perl and Rust. See the [testing guide](../contributing/testing.md#shared-real-lean-type-corpus) for prerequisites and toolchain overrides.

Nine of the 17 shared-corpus adapters are implemented. C, C++, .NET, Java, Kotlin, PHP native/WASM and WIT/WASI remain, along with reviewed-IR execution and the remaining type families, positions and semantics. The inventory retains 656 installed-tested cells. No registry publication is part of this milestone.
