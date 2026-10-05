# Compiler-checked reviewed Wasm APIs

This milestone extends VO 1216 and 1217 to npm, PHP-Wasm and compatible combined releases. Independently reviewed contracts compile against fresh Lean metadata, reproduce their package archives, and execute through installed public APIs without the author workspace or Lean compiler.

## Build contract

The [author guide](../lean/existing-package.md#compile-a-reviewed-contract) describes source authorization and supported review decisions. npm admits the sixteen primitive parameter/result types. Native and PHP-Wasm also admit copied arrays and immutable records. A combined release must expose the same reviewed API through every selected ABI; it cannot silently drop declarations that npm cannot represent.

npm captures the exact review in its version-3 source intent. The compiler invocation binds the review together with source, interface, compiler and extractor identities. Fresh target-C compilation must reproduce the retained elaboration report. Package assembly reconstructs the source intent and checked API before accepting the bundle. Package receipts bind these artifacts through their existing hashes.

PHP-Wasm uses the same reviewed-source reconciliation as native compilation. Its model and compilation receipt retain the raw review, file hash and semantic hash. Artifact verification repeats the source correspondence and model checks. Mixed releases require matching reviewed input and source API identities across profiles, compile once per selected ABI, and expose the completed output directory only when every target succeeds.

Compiler-free `analyze` remains separate: validating a document does not establish agreement with its Lean source.

## Installed acceptance

The [reviewed Wasm corpus](../../tests/type-corpus-reviewed-wasm.test.mjs) passed in 412.2 seconds. It built `Shop.Pricing` and `Telemetry.Readings` twice from relocated locked projects, checked exact archive equality, removed the author/build directories, and installed the copied packages offline. Expected results came from independently compiled Lean oracles.

The report records **12 installed runs, 744 catalog cases, 684 executed cases and 60 explicit unsupported cases**.

| Profile | Executed cases | Unsupported cases |
| --- | ---: | ---: |
| Node JavaScript | 112 | 12 |
| Node TypeScript | 112 | 12 |
| Browser JavaScript | 112 | 12 |
| React | 112 | 12 |
| Browser worker | 112 | 12 |
| PHP-Wasm | 124 | 0 |

All three browser profiles executed in Chromium, Firefox and WebKit. TypeScript consumers compiled in strict mode. The browser checks retain deployment, asset, lifecycle and failed-load recovery evidence. PHP-Wasm executed 24 package/loading/caller combinations across the two libraries: Node embedded/Composer APIs and Chromium bundles, each with startup/lazy loading and weak/strict callers. These repeated routes do not inflate the catalog case count.

npm's reviewed contracts select primitive declarations only. Array and record cases remain unsupported; fresh compiler checks also reject attempts to add those declarations to the review. PHP-Wasm executes the copied arrays and records. Pending `Option` and `Except` source signatures fail compilation rather than inheriting a primitive type claimed by the review.

The report observes 201 scoped reviewed-IR cells and retains 6,361 gaps across the complete corpus grid. These results do not promote unrelated type families or untested positions in the support inventory.

## Combined releases and integrity checks

The [combined-build acceptance](../../tests/php-wasm-multi-profile.test.mjs) passed all four target selections in 333.2 seconds: npm/native PHP/PHP-Wasm, reversed target order, native PHP/PHP-Wasm, and npm/PHP-Wasm. Each selection compiled once per ABI, reproduced archives from relocated sources, verified the package-set receipt, and executed relocated installed packages after hiding the original sources and build outputs.

An initial run correctly rejected a fixture whose review asserted version `1.0.0` while its `lakefile.lean` source inventory reported `0.0.0-local`. The independent test contract now uses that expected source identity; the compiler comparison was not relaxed.

Fresh-Lean checks cover the eight native admission/drift scenarios and four scalar cases: an admitted namespace/module mismatch, changed parameter and result types, and a changed public export name. Additional tamper checks reject missing or changed retained reviews, altered compiler requests, changed generated parameter names and bypassed review capture. Mixed-profile checks reject omitted or invented review identities.

The installed-report validator rejects altered receipts, review bytes, source correspondence and isolation claims. Relabeling ordinary-source execution as reviewed execution also fails. The admission-only suite passed 14 tests and retained its separate result: two compiler-free analyses, 34 blocked builds without authorized source modules, and zero installed observations.

## Identities and reproduction

The full report is `build/type-corpus/reviewed-wasm-browser-javascript-browser-react-browser-worker-node-javascript-node-typescript-php-wasm.json`.

- Reviewed harness identity, covering 88 files: `8b1782aed54699eccd7e5a6027e8ec10a6b5f24f547f636698ee07fbdaec816d`.
- Shared 56-file corpus identity: `082120e34b2ce973451b73305c258ce715ecfc5e7867b99626acb2afb243a223`.
- npm runtime identity: `028689e4e9c7096376e3a9a78da3ce5ff1bce3b16332f1d224a06583de673580`.
- PHP-Wasm runtime identity: `cf6fd0c4430e142677d32ae69d2f0585c667c1fcabb4b26a43c4d68789b48c5c`.
- Shop primitive review semantic hash: `4b1e16878fae6889cfbf268d0b4987b50fb1f4f0dec0378a5159b2b05e188225`.
- Telemetry primitive review semantic hash: `8fb6b54adfbc58bdd497e0e3fe15b8622f39f5851c148bf32f4303fa4a8cf66f`.

PHP-Wasm uses the full copied-value contracts recorded in the [native milestone](reviewed-native-20260918.md). Local acceptance used Linux x86-64, Node 22.23.2 and Lean 4.32.2 at `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. Mixed native checks used the local glibc 2.36 test override; the production floor remains 2.38.

With the toolchains from the [testing guide](../contributing/testing.md#compiler-checked-reviewed-wasm-corpus):

```sh
source scripts/env.sh
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit \
  npm run test:type-corpus:reviewed-wasm
LEAN_BRIDGE_REVIEWED_MULTI_PROFILE_TEST=1 \
  node --test tests/php-wasm-multi-profile.test.mjs
```

Required npm and PHP-Wasm CI jobs now execute both source paths and require both reports in their existing artifacts. The PHP job also runs ordinary and reviewed combined-build acceptance. Nix execution remains a CI check; this local host has no Nix installation.

## Regression checks

Reviewed C/Python regression passed in 195.9 seconds: four offline installed runs, 218 executed cases and 30 expected C compiler rejections. Both libraries reproduced their archives. CLI packaging, filtered Nix-source closure and release-boundary checks passed all 17 tests.

Ordinary-source regression passed all 411 tests in 520.4 seconds. Both libraries rebuilt and installed through Python, native PHP, Node JavaScript, Node TypeScript and PHP-Wasm, covering all three build transports. The ten installed runs record 596 executed catalog cases and 24 unsupported npm aggregate cases. PHP-Wasm separately records 24 Node/Chromium loading/caller routes and 1,728 supplemental rejection/recovery checks. Six unsupported-source builds rejected correctly. The report is `build/type-corpus/node-javascript-node-typescript-php-native-php-wasm-python.json` and uses the shared corpus identity above.

Core checks passed lint, typechecking and 1,143 tests, with 59 gated tests skipped. Documentation checks passed all 65 tests; site and demo checks passed all 111 tests. Site typechecking and the build passed for all 79 canonical documentation pages.

Author, publication, diagnostics, architecture and contributor guides describe the admitted reviewed paths. The generated type reference distinguishes standalone generators from compiler-backed packages, replacing stale Alpha-only and Rust-wide rejection claims. Type-support states remain unchanged; only their evidence source digests were refreshed.

Broader type families and positions remain work under VO 1216, 1217 and 1218. This milestone does not publish a registry package.
