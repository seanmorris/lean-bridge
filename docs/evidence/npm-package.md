# NPM package evidence

## Result

The flake exposes `npm-package` as a compile-free projection of `universal-release-bundle`. The output contains an installable `lean-bridge-alpha-0.0.0.tgz`, its expanded package tree, and the packaging policy report.

A clean consumer installs the tarball with ordinary npm commands:

```sh
nix --extra-experimental-features 'nix-command flakes' build .#npm-package
npm install ./result/lean-bridge-alpha-0.0.0.tgz
```

The package exports `Box`, `roundTrip`, `withCallback`, and `makeAdder`. Its export map exposes no internal subpaths. The consumer constructs and disposes a Lean object, observes canonical identity, moves a typed record containing a boolean, unsigned integer, Unicode string, `Uint8Array`, and integer array across the boundary, invokes JavaScript from Lean, and calls a returned Lean closure.

```js
import { Box, roundTrip } from "@lean-bridge/alpha";

const box = new Box(42);
console.assert(box.read() === 42);
console.assert(box.identity() === box);
box.dispose();

const output = roundTrip({
  enabled: true,
  count: 41,
  label: "Lean λ bridge",
  bytes: new Uint8Array([0, 127, 255]),
  values: [0, 0xffff_ffff],
});
```

The package uses generated JavaScript and TypeScript files from the canonical bundle. Its internal runtime loads the immutable main module and Alpha side module through literal `new URL(..., import.meta.url)` expressions. This gives bundlers static asset paths without exposing the loader to application code.

## Packaging boundary

The npm derivation receives Node 22 and the immutable universal bundle. It receives no Lean, C, C++, Rust, Emscripten, linker, or Wasm compiler. Before copying a file, the backend validates the canonical manifest and checks every inventoried artifact against its byte count and SHA-256 hash.

The packaging policy permits file selection, arrangement, copying, renaming, registry metadata rendering, archiving, and compression. It rejects compiler access and package lifecycle scripts. The report records source and package hashes for the Emscripten module, shared runtime Wasm, and Alpha side module. Every pair must match.

The package version, component identity, Binding IR identity, license, and canonical manifest identity come from the bundle. The backend cannot supply alternate semantics or version metadata.

## Reproducibility

The backend writes a sorted ustar archive with fixed ownership, permissions, modification time, and gzip settings. Two empty output roots receive byte-identical tarballs from the same bundle.

The verified Nix build reused core derivation `/nix/store/7cbsqgw6dfc0x9km5c0xd4fr2nvvar0b-lean-alpha-universal-core-artifacts-0.0.0.drv`. Adding the npm backend did not rebuild the Lean runtime or component Wasm.

## Tests

[`tests/npm-package.test.mjs`](../../tests/npm-package.test.mjs) verifies:

- byte-identical tarballs from two projections;
- unchanged core bytes at every renamed package path;
- a closed public export map with no lifecycle scripts;
- literal main-module and side-module asset URLs;
- installation into a clean npm consumer;
- direct class, copied-value, callback, and closure calls;
- rejection of internal package imports; and
- rejection of a changed canonical Wasm artifact before packaging.

Run the focused gate:

```sh
node --test tests/npm-package.test.mjs
nix --extra-experimental-features 'nix-command flakes' build .#npm-package --no-link
```

The current Emscripten launcher targets Node. The package does not claim browser execution. A browser and bundler matrix must run before a browser-compatible registry release.
