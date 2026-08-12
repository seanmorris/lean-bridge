# Universal release bundle evidence

## Result

The flake exposes separate compiled and assembled outputs:

- `universal-core-artifacts` compiles the side-lazy shared runtime and Alpha, Beta, and Gamma components.
- `native-core-artifacts` compiles the process-wide native Lean runtime and Alpha component.
- `wasi-component-artifacts` builds the Component Model adapter and independent Wasmtime host.
- `universal-release-bundle` arranges those immutable artifacts with generated bindings and release evidence.

The second derivation has no Lean, C, C++, Emscripten, linker, or Wasm compiler in its build inputs. It receives the core output as a read-only Nix store path and writes a new bundle.

The full bundle contains 97 inventoried artifacts. It includes the Emscripten runtime and components, native runtime and component libraries, the Component Model adapter and host, the Lean source, locks, Binding IR, all generated host bindings, schemas, validators, documentation, license, assurance, SBOM, and provenance. Packaging backends can project all six ecosystem packages without reading source files outside the bundle.

## Compilation boundary

[`nix/core-source-boundary.json`](../../nix/core-source-boundary.json) defines the files that can affect the core derivation. The allowlist contains the Lean sources and shims, ABI and graph code used by the compiler path, runtime patches, and eight build scripts. It excludes binding backends, release policy, registry packaging, tests, and documentation.

A change to `src/backends/javascript/generate.mjs`, `src/release/backend-policy.mjs`, or another packaging file does not enter the core source store path. Nix therefore keeps the same core derivation and output. A change to `Alpha.lean`, its Binding IR, its capsule, the graph lock, a runtime patch, or a compiler-path script changes that input and invalidates the core derivation.

This is an allowlist instead of a list of known packaging directories. New files stay outside the trusted compilation input until a contributor reviews and adds them.

The flake-level probe added a comment to the excluded `src/release/backend-policy.mjs` file and evaluated the core output before and after the change. Both evaluations produced `/nix/store/7cbsqgw6dfc0x9km5c0xd4fr2nvvar0b-lean-alpha-universal-core-artifacts-0.0.0.drv`. Nix did not create a new core derivation.

## Content identity

`metadata/core-artifact-set.json` records the path, byte count, SHA-256 hash, and executable bit for:

- `lazy/main.mjs`
- `lazy/main.wasm`
- `lazy/alpha.so.wasm`
- `lazy/beta.so.wasm`
- `lazy/gamma.so.wasm`

Its identity is the SHA-256 hash of the canonical file records and graph profile. `canonical-package.json` then binds that core set to all sources, locks, generated bindings, targets, assurance claims, licenses, SBOM, provenance, and toolchain identity. `canonical-package.sha256` gives the bundle its release identity. A registry backend can change package layout metadata, but its policy requires every projected core hash to remain equal to the source hash.

The verified Nix build produced core identity `6d35a6ea087f84f9390e5faf5d60526c4b657c551f2a7345616387bff4489c24`. The canonical manifest identity changes when the recorded source revision changes, while the isolated core identity remains stable.

The full Nix bundle marks npm, Cargo, PyPI, C, C++, and WIT/WASI eligible. The source-only unit fixture omits native and WASI inputs so tests can continue to verify fail-closed target behavior. Browser support is established separately by installing the npm archive and executing its conditional export in Chromium.

## Tests

[`tests/universal-release-bundle.test.mjs`](../../tests/universal-release-bundle.test.mjs) verifies:

- compiler inputs are inside the allowlist and packaging inputs are outside it;
- two empty output roots receive byte-identical bundles;
- every manifest artifact matches the actual file size and SHA-256 hash;
- the bundled validator imports from the finished tree and validates its own manifest;
- JavaScript, PHP, Python, C, C++, Rust, and WIT generated bindings are present;
- the npm mapping names the Node ESM target and its packaged loader artifacts;
- provenance and SBOM records name the exact core identity; and
- a valid changed packaging plan cannot alter the compiled file set.

Run the focused gate:

```sh
node --test tests/universal-release-bundle.test.mjs
nix --extra-experimental-features 'nix-command flakes' build .#universal-release-bundle --no-link
nix --extra-experimental-features 'nix-command flakes' build .#npm-package --no-link
```

[The npm package evidence](npm-package.md) records the deterministic projection and clean consumer test.
