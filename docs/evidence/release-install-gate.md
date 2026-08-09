# Clean install and no-rebuild gate evidence

## Result

One release rehearsal installs npm and C packages into empty consumer projects, calls both through their ordinary public APIs, traces every installed package file, and verifies every packaging backend plan. The gate requires at least one JavaScript package and one non-JavaScript package.

The npm consumer installs the local tarball with scripts disabled, network use disabled, and no registry audit. It imports `Box` from `@lean-bridge/alpha`, constructs a value, reads `42`, checks identity, and disposes the object.

The C consumer extracts the local archive, locates `LeanBridgeAlpha` through generated CMake metadata, links `LeanBridge::Alpha`, constructs a `lean_alpha_box`, reads `42`, checks identity, and disposes the object. The C package uses the reviewed external runtime fixture because the canonical bundle does not yet contain a native Lean component. This test establishes C installation, generated call behavior, and parity of the public `Box` contract. It does not claim a native C call into Lean.

Both consumers read generated documentation and version `0.0.0` from their package metadata. Their observations agree on the value and identity results.

## Installed-file trace

`traceInstalledPackage` inventories every regular file under the installed package root and hashes its bytes. It accepts three trace classes:

- canonical artifact, where the installed bytes equal an artifact in `canonical-package.json`;
- canonical control record, where the bytes equal the canonical manifest, its hash inventory, or the bundle identity; and
- backend-derived file, where a reviewed ecosystem rule names the path, generator, purpose, and canonical manifest input.

The npm backend may derive only `package.json` and `internal/runtime.mjs`. The C backend may derive only its pkg-config file and three CMake files. An unmatched file blocks the gate. The test injects one unreviewed generated file and confirms that tracing rejects it.

The gate also compares each npm core artifact in the installed package to its source bytes in the canonical bundle. Every pair is byte-identical.

## Compiler isolation and build trace

The rehearsal CLI runs under the Node permission model. It receives read access to the project and canonical bundle plus read and write access to its local output. It receives no child-process permission. A packaging backend cannot invoke Lean, Lake, C, C++, Rust, Emscripten, CMake, a linker, or a package lifecycle command during the rehearsal.

Every emitted backend plan also passes the closed packaging policy. The policy requires `compilerAccess: false`, disables scripts, limits operations, rejects compiler and linker command names, and requires equal source and package hashes for every core artifact.

The flake exposes `release-rehearsal` as a `stdenvNoCC` derivation. Its only explicit native build input is Node 22. It consumes the immutable `universal-release-bundle` and runs the same permission-isolated CLI. Nix supplies a network-isolated build sandbox and preserves the separate core derivation.

The verified Nix rehearsal used `/nix/store/7p8m52zwk9fhz7n3zpbdfz1sqacz6rff-lean-alpha-release-rehearsal-0.0.0.drv`. Its direct derivation inputs are the universal release bundle, Node 22.10.0, Bash, and `stdenvNoCC`. The isolated compiled core remains `/nix/store/7cbsqgw6dfc0x9km5c0xd4fr2nvvar0b-lean-alpha-universal-core-artifacts-0.0.0.drv`, the same core derivation recorded before the registry backends and rehearsal existed.

## Tests

[`tests/release-install-gate.test.mjs`](../../tests/release-install-gate.test.mjs) verifies:

- npm and C are both ready under one reviewed canonical identity;
- the rehearsal completes without child-process permission;
- backend plans contain no compiler or linker command;
- npm installs offline with lifecycle scripts disabled;
- C configures and builds through generated CMake discovery;
- both native surfaces return the same value and identity observations;
- generated docs and versions are present;
- every installed package file has a canonical or reviewed derived trace;
- installed npm core bytes equal the canonical bundle; and
- an unreviewed installed file blocks the trace.

Run the gates:

```sh
npm run test:release-install-gate
nix --extra-experimental-features 'nix-command flakes' build .#release-rehearsal --no-link
```

The next native-package milestone replaces the C runtime fixture with a canonical native Lean runtime and component artifact. The current gate keeps that boundary explicit.
