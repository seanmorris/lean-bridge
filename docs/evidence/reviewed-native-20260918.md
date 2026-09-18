# Compiler-checked reviewed native APIs

This milestone covers VO 1216 and 1217. Two independent reviewed contracts now compile into native packages after reconciliation with fresh Lean metadata. The packages execute without the author workspace or Lean compiler.

## Source admission

[`reviewed-source.mjs`](../../src/analyze/reviewed-source.mjs) requires one schema-3 `.binding-ir.json` document and explicit source modules in `lean-bridge.exports.json`. The review selects exact declarations. Lake resolves module ownership and dependencies; declaration namespaces do not determine source paths.

The builder checks component identity, exported names, parameter and result types, nominal record identities, field order, ownership, effects and failure behavior against fresh elaboration. It retains reviewed documentation and argument names. Native layouts and theorem references come from Lean. Unsupported defaults, optional arguments, extensions, assurance claims, resources, callbacks and asynchronous operations fail explicitly.

The compiler request binds the complete reviewed input alongside source, interface and toolchain identities. Native model schema 3 retains the raw review and its file and semantic hashes in `sourceIdentity.reviewedBindingIr`. The compilation receipt carries that identity; the release manifest also names the reviewed semantic hash. Artifact verification reconstructs the model and repeats the contract comparison against retained compiler metadata and the source inventory.

Compiler-free analysis remains separate. npm, PHP-Wasm and mixed native/Wasm builds still reject reviewed documents.

## Installed acceptance

The [reviewed corpus](../../tests/type-corpus-reviewed-native.test.mjs) builds `Shop.Pricing` and `Telemetry.Readings` twice from relocated locked projects with local and pinned Git dependencies. It compares exact archives, removes the author workspace, then installs the copied packages offline. Consumers call the generated public APIs and compare results with a separately compiled Lean oracle.

Both libraries passed all eleven native profiles in 992.1 seconds. The run records **22 installed runs, 1,162 executed cases and 202 compiler rejections**. Every archive reproduced byte-for-byte.

| Profile | Executed cases | Compiler rejections |
| --- | ---: | ---: |
| C | 94 | 30 |
| C++ | 92 | 32 |
| .NET | 92 | 32 |
| Java | 104 | 20 |
| Kotlin | 100 | 24 |
| Perl | 124 | 0 |
| Native PHP | 124 | 0 |
| Python | 124 | 0 |
| Ruby | 124 | 0 |
| Rust | 84 | 40 |
| WIT/WASI | 100 | 24 |

The catalog covers all sixteen admitted primitive parameter/result types, arrays, nested arrays, immutable records, invalid inputs and recovery. The report observes 451 scoped reviewed-IR cells and retains 6,111 gaps across the full corpus grid. Ordinary-source observations live in separate reports. These cases do not promote the broader type-support inventory.

PHP repeats its checks in weak and strict modes. Its reflection checks require `arg0`, `arg1`, etc. for ordinary-source exports and the independently reviewed `value0`, `value1`, etc. for reviewed exports, including PHPDoc. The initial combined run exposed the harness's assumption that every API used compiler-default argument names. The corrected test checks both contracts exactly; the generated PHP API needed no change.

## Identities and reproduction

The combined report is `build/type-corpus/reviewed-native-c-cpp-dotnet-java-kotlin-perl-php-native-python-ruby-rust-wit-wasi.json`.

- Reviewed harness identity, covering 78 files: `5bd5cfb85fc7fc62351f3deab7730bcd85dccc299c356aad735e08ac8bb1bbb3`.
- Shared corpus identity: `f1981016e5df442d735f3dd04d918351fcbf3867bb7aa1a5e390361c6e02aece`.
- Native runtime identity: `e7d08d91baf7f70d791a79bd611779d311201ce6b6530f478be4f8ff1113be1f`.
- Shop reviewed semantic hash: `5fb9d8cab51b447cb16054a9506d54cb736500ce761dcee57fd86ff3029eb95c`.
- Telemetry reviewed semantic hash: `ce6fe88fcf08a3fad2dd5971600213c0872ea07466e321bdb6f8b4ecea7bea4b`.

With the host toolchains from the [testing guide](../contributing/testing.md#compiler-checked-reviewed-native-corpus):

```sh
source scripts/env.sh
npm run test:type-corpus:reviewed-native
```

Local acceptance used Linux x86-64, Lean 4.32.2 at `f3b06c705e6c85f5314019d5d3baab0fec5b580c`, and the local glibc 2.36 test override. The production floor remains 2.38. Per-target configurations bind different source identities, so their archive and generated IR hashes need not match this combined selection.

The required consumer CI gates run both source paths for every native profile, including all four Perl configurations. Each step requires both report files before uploading its artifact. This local run used threaded Perl 5.38.2; the other Perl configurations remain CI checks.

## Rejection and integrity checks

The [fresh-Lean checks](../../tests/reviewed-source-build.test.mjs) passed eight scenarios: an admitted namespace/module mismatch, changed parameter and result types, changed record field order and name, an export outside authorized roots, a changed source signature, and review-file drift during compilation. Invalid cases stop before native linking and leave no component output.

The [contract tests](../../tests/reviewed-source.test.mjs) reject unsupported defaults, effects and claimed theorem evidence, changed review bytes and hashes, unauthorized source selection, and missing review/source correspondence. The installed-report validator also rejects altered model, metadata, receipt and source identities, invented isolation claims, and relabeling ordinary observations as reviewed execution.

The admission-only corpus still checks two compiler-free analyses and 34 blocked builds without authorized source modules across all seventeen profiles. It records no installed coverage. See the [preceding admission milestone](type-corpus-reviewed-ir-20260917.md).

## Regression checks

The ordinary-source regression passed all 411 tests in 600.5 seconds. It installed both libraries through Python, Perl, native PHP, Node JavaScript, Node TypeScript and PHP-Wasm: twelve installed runs covering all three build transports. The report records 720 executed catalog cases and 24 unsupported cases. PHP-Wasm also passed its Node and Chromium routes, including startup and lazy loading. The report is `build/type-corpus/node-javascript-node-typescript-perl-php-native-php-wasm-python.json` and uses the shared corpus identity above.

Core checks passed lint, typechecking and 1,143 tests, with 57 gated tests skipped. Documentation checks passed all 65 tests; site and demo checks passed all 111 tests. Site typechecking and the build passed for all 79 canonical documentation pages. CLI and Nix source-allowlist checks passed locally; Nix execution remains a CI check because this host has no Nix installation.

Reviewed npm/PHP-Wasm compilation, additional type families, and untested positions remain work under VO 1216 and 1217. This milestone does not publish a registry package.
