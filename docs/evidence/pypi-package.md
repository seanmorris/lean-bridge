# PyPI package evidence

## Result

The canonical Alpha bundle is eligible for PyPI projection on x86-64 Linux with glibc 2.38 or newer. The backend creates a deterministic `py3-none-manylinux_2_38_x86_64` wheel and source archive without invoking Python, pip, Lean, a C compiler, or a linker.

The wheel contains generated Python modules, inline types, `.pyi` stubs, `py.typed`, the lazy native runtime adapter, the Alpha component library, and the shared Lean runtime. Package metadata, license, assurance, SBOM, provenance, canonical identity, and wheel `RECORD` hashes come from the canonical bundle.

## Consumer acceptance

`npm run test:consumer:native` installs the wheel offline with no dependency resolution into a clean directory. The public Python API executes real Lean for:

- `Box` construction, read, identity, context management, and close;
- copied `Payload` values containing UTF-8, bytes, and `u32` arrays;
- a Python callback invoked by Lean; and
- a returned Lean closure invoked and closed by Python.

The component loads only on the first public call. No installation script runs.

## Reproducibility

The wheel writer sorts paths, fixes timestamps and permissions, uses deterministic deflate settings, and records SHA-256 hashes in wheel format. The source archive uses sorted ustar entries, fixed ownership, the canonical source date epoch, and fixed gzip settings. [`tests/pypi-package.test.mjs`](../../tests/pypi-package.test.mjs) retains failure-closed checks for incomplete mappings and invalid wheel tags. [Native consumer acceptance](native-consumer-acceptance.md) records real Lean execution.
