# Plain component target C evidence

## Result

The pinned Lean 4.32.2 compiler compiled the small and medium onboarding projects from immutable component closures. Neither project contains export annotations or handwritten bridge wrappers.

The compiler reported Git commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. The driver compared that identity with the shared runtime plan before compiling any module.

The medium project compiled in this order:

```text
OnboardingMedium.Collections
OnboardingMedium
LeanBridgeGenerated
```

Its target C manifest has SHA-256 identity `13499eca07cbc3fdae6478360d0243cceeaa631e316f8f3e9464e0e9759ca8ba`. The manifest binds these target C outputs:

| Module | Target C SHA-256 |
| --- | --- |
| `OnboardingMedium.Collections` | `650fbd1c309d16794317e0cfffc1e326bed31628a7d3bd49fee33dc10c487115` |
| `OnboardingMedium` | `944813fa731e313c2f21f53c63041badb873719732615fd53a26795a6f8de116` |
| `LeanBridgeGenerated` | `57f733723745fe724ddd274928294e82cd644aba1a838492e6613143f130f833` |

The same medium project was copied to a different checkout root and compiled again. Its compilation plan, target C manifest, target C files, and olean files matched byte for byte.

The small fixture's generated target C defines both planned direct symbols and `initialize_LeanBridgeGenerated`. It contains no `ccall`, `cwrap`, or generic dispatch path.

## CI gate

[`tests/lean-component-compiler.test.mjs`](../../tests/lean-component-compiler.test.mjs) invokes the real pinned compiler twice from different roots. The test compares complete manifests and generated target C, then checks every direct symbol against the compilation plan. Mocked tests separately cover invocation order and compiler drift failures.

[`scripts/compile-plain-component-target-c.mjs`](../../scripts/compile-plain-component-target-c.mjs) exposes the same path for architecture testing:

```sh
npm run build:component-target-c -- \
  --project path/to/plain-lean-project \
  --output build/component-target-c
```

The next gate links the manifest's exact target C files into one runtime-free Emscripten side module.
