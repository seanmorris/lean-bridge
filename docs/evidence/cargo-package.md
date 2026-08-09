# Cargo package evidence

## Result

The Cargo backend projects generated Rust sources, package metadata, licenses, assurance records, provenance, and selected canonical artifacts into a deterministic `.crate` archive. The backend reads only the canonical bundle and writes into an empty output directory. It has no compiler access and does not run Cargo, Rust, Lean, C, C++, a linker, or a package build script.

The current Alpha bundle is not eligible for Cargo publication. It contains generated Rust bindings, but it does not contain a native component library or a Rust runtime adapter. The backend returns `package-ineligible` before it copies or archives package files. This prevents a type-correct crate from being presented as a callable Lean component.

## Eligible package path

The successful packaging fixture adds a reviewed `rust-bindings` target to a copy of the canonical manifest. It keeps every artifact byte unchanged, selects every generated Rust file, updates the canonical identity, and declares that an external shared-runtime adapter is required.

The backend then writes:

- `Cargo.toml` using the canonical package name, version, license, repository, target, and semantic hashes;
- generated `src/lib.rs` and `src/__runtime.rs` without rewriting their binding semantics;
- generated documentation and the binding manifest;
- docs.rs metadata and a closed empty feature set;
- the MIT license;
- source revision metadata;
- the canonical manifest, assurance data, SBOM, provenance, and core identity; and
- byte-identical copies of every artifact selected by the Cargo mapping.

The `.crate` archive uses the normal `name-version/` root. Its ustar headers use sorted paths, fixed ownership, fixed permissions, the canonical source date epoch, and fixed gzip settings.

## Tests

[`tests/cargo-package.test.mjs`](../../tests/cargo-package.test.mjs) verifies:

- the real Alpha bundle fails with its specific native-runtime gap;
- two empty output roots receive byte-identical `.crate` files for an eligible target;
- the packaging plan has no compiler access, lifecycle scripts, Cargo command, or Rust compiler command;
- generated Rust files, provenance, and assurance records remain in the archive;
- Cargo compiles the expanded crate offline with warnings denied; and
- omitting one generated Rust file from the reviewed selection blocks packaging.

Run the focused gate:

```sh
node --test tests/cargo-package.test.mjs
```

The successful fixture proves registry layout and archive behavior. It does not prove a Rust call into the real Lean component. Cargo publication remains blocked until the canonical build adds a native component library and a generated Rust runtime adapter that pass the same semantic conformance corpus used by JavaScript and PHP.
