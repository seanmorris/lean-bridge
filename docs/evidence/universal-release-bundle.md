# Universal release bundle evidence

## Result

The flake exposes two separate outputs:

- `universal-core-artifacts` compiles the side-lazy shared runtime and Alpha, Beta, and Gamma components.
- `universal-release-bundle` arranges those immutable artifacts with generated bindings and release evidence.

The second derivation has no Lean, C, C++, Emscripten, linker, or Wasm compiler in its build inputs. It receives the core output as a read-only Nix store path and writes a new bundle.

The current bundle contains 78 inventoried artifacts. It includes the Emscripten runtime loader and Wasm runtime, three independently compiled side modules, the Lean source, graph and flake locks, Binding IR, JavaScript and TypeScript, PHP, Python, C, and Rust binding sources, schemas, an executable validator module tree, generated documentation, the MIT license, assurance metadata, an SPDX 2.3 SBOM, and an in-toto statement using the SLSA provenance predicate. The bundle also carries the generated Alpha loader descriptor, browser-safe Binding IR hashing, and the exact JavaScript runtime modules required to consume it. An npm backend can therefore project the package without reading source files outside the bundle.

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

The bundle marks the npm package eligible because it contains every compiled artifact, generated binding, loader contract, license, and provenance record required by that projection. The package targets Node 22 ESM. The `browser` name in compiled artifact paths identifies the unthreaded Wasm memory profile and does not claim browser execution. A browser bundler fixture remains required. Cargo, PyPI, C, and C++ mappings remain ineligible because this core derivation does not contain a native component library. The manifest reports each limit directly.

## Tests

[`tests/universal-release-bundle.test.mjs`](../../tests/universal-release-bundle.test.mjs) verifies:

- compiler inputs are inside the allowlist and packaging inputs are outside it;
- two empty output roots receive byte-identical bundles;
- every manifest artifact matches the actual file size and SHA-256 hash;
- the bundled validator imports from the finished tree and validates its own manifest;
- JavaScript, PHP, Python, C, and Rust generated bindings are present;
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
