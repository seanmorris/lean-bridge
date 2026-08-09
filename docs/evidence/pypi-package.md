# PyPI package evidence

## Result

The PyPI backend projects eligible canonical bundles into a deterministic wheel and source archive. It copies generated Python modules and `.pyi` stubs, renders package metadata from canonical fields, writes wheel integrity records, carries licenses and provenance, and preserves every selected artifact byte.

The backend does not run Python, pip, setuptools, Lean, Nix, Emscripten, C, C++, or a linker. Python and pip run only after packaging as consumer validation.

The current Alpha bundle is not eligible for PyPI publication. Its generated Python package defines a complete typed runtime protocol, but the canonical bundle contains no native component library or Python extension adapter. The backend returns `package-ineligible` before creating a wheel. A downstream developer cannot mistake an importable type layer for an executable Lean component.

## Eligible package path

The successful packaging fixture adds a reviewed `python-bindings` target to a copy of the canonical manifest. It keeps all artifact bytes unchanged, selects every generated Python file, identifies the target as pure Python, records its external shared-runtime adapter requirement, and updates the canonical identity.

The backend emits:

- a `py3-none-any` wheel with generated modules, inline types, `.pyi` stubs, and `py.typed`;
- a source archive with `pyproject.toml`, generated sources, package metadata, and the license;
- wheel `METADATA`, `WHEEL`, `top_level.txt`, and hash-complete `RECORD` files;
- the canonical manifest, assurance records, SBOM, provenance, and core identity; and
- byte-identical copies of every artifact selected by the PyPI mapping.

The canonical target must declare `pure-python-bindings` or an explicit `wheel-tag:<python>-<abi>-<platform>` capability. The backend does not infer a platform tag from a filename.

## Reproducibility

The wheel writer sorts paths, fixes timestamps and permissions, uses deterministic deflate settings, and records SHA-256 hashes using the wheel format. The source archive uses sorted ustar entries, fixed ownership, fixed permissions, the canonical source date epoch, and fixed gzip settings.

## Tests

[`tests/pypi-package.test.mjs`](../../tests/pypi-package.test.mjs) verifies:

- the real Alpha bundle fails with its specific native-extension gap;
- two empty output roots receive byte-identical wheels and source archives;
- the backend plan has no compiler, Python, pip, Lean, or Emscripten command;
- wheel and source archives contain generated types, provenance, and package metadata;
- pip installs the wheel offline without dependencies;
- an installed consumer imports `Payload` and retains bytes and tuple field types;
- an eligible target without a reviewed wheel tag fails; and
- omitting one generated `.pyi` file from the canonical selection fails.

Run the focused gate:

```sh
node --test tests/pypi-package.test.mjs
```

The successful fixture proves registry layout, wheel integrity, offline installation, import behavior, and typed copied values. It does not prove a Python call into the real Lean component. PyPI publication remains blocked until the canonical build adds a native component library and generated Python runtime adapter that pass cross-language conformance.
