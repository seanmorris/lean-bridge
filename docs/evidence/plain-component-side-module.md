# Plain component side-module evidence

## Result

The medium onboarding project now compiles and links into one 2,363-byte WebAssembly side module:

```text
artifacts/onboarding-medium-48e5c7de2f9afdb3.so.wasm
SHA-256 030318765bd7851be0f90a8ce92980891f672d4d9ae58068ce284f65b70a30ff
```

Emscripten 6.0.6 at commit `ce75e06884093bcefb86a6b8fd56a5d62a4cc245` produced the artifact with `SIDE_MODULE=2`.

The module imports exactly one memory and one function table from `env`. It defines and exports no memory or table. Its remaining imports are `initialize_Init` and Lean runtime functions that the app's one shared runtime must provide.

The link command does not contain `libleanrt.a` or `libInit.a`. The normalized link map contains neither archive, a checkout path, nor a build staging path.

The Wasm export section contains all five generated direct symbols, `initialize_LeanBridgeGenerated`, and one component-private initialization trampoline. The trampoline performs the indirect initialization call through the shared function table. Generated JavaScript and other host bindings will hide this private symbol.

The link manifest has SHA-256 identity `7d3d9a626bfdf958aad0e8e871a1b178c70519b125ae11f8a5a022f74d1d89be`. It binds the side module to:

- component plan `a932a2cbfa31cc1b3b3a7940e6e038fcc8aa67049c9f3ccc975ba4483979f442`;
- compilation plan `cf46c019996ba05fac9deb43b2192ff26ab3df1e5d1851926bb358c9c496c9d3`;
- target C manifest `13499eca07cbc3fdae6478360d0243cceeaa631e316f8f3e9464e0e9759ca8ba`;
- the generated initializer shim, normalized link map, direct symbols, linker identity, and shared-runtime policies.

Two builds from different checkout roots produced byte-identical Wasm and link manifests.

## Command

[`scripts/build-plain-component-side-module.mjs`](../../scripts/build-plain-component-side-module.mjs) executes analysis, immutable staging, target C compilation, and side-module linking:

```sh
npm run build:component-side -- \
  --project path/to/plain-lean-project \
  --output build/component-side-module
```

The next gate turns these structural claims into a standalone artifact auditor that rejects any drift before packaging.
