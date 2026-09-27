# Ruby generated-module loading

VO task 1219. Execution date: 2026-09-27.

The generated Ruby modules load compiled Lean after the compiler workspace has
been removed. Ordinary-source and independently reviewed-source tests each pass
17 checks, including callbacks, retained values, relocation, private GMP
resolution, and fork rejection while the parent holds the loader lock. Both
finish with zero native identities.

The loader authenticates regular library files, rejects symlinks and modified
bytes, rejects unverified Lean preloads, and rejects Ruby M:N threading. It uses
the private GMP library documented in
[the GMP execution record](owned-ruby-gmp-20260927.md).

Two failures led to implementation changes:

- glibc can return a null handle for an `RTLD_NOLOAD` probe without setting a
  loader error. Ruby Fiddle wraps that null handle. Calling `close` on it crashed
  Ruby. The generated loader now checks the numeric handle before closing it.
- Library-map insertion order changed generated source. The loader now sorts
  library names. A regression reverses map insertion order, and independent
  regeneration from each recorded input matches every generated file hash.

Final command:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-ruby-package.test.mjs
```

Result: 3 passed, zero failed, zero skipped, 184,088 ms. Selected source and test
lint also passed. The [machine-readable record](owned-ruby-loading-20260927.json)
contains source hashes, both compiler-backed reports, generated file hashes,
loader identities, command output, and references to the unchanged conversion
and GMP records.

These tests load generated module directories, not installed gems. The records
set `installedPackage: false`. Gem assembly, installed-package tests, copied and
owned package coexistence, canonical build admission, CI registration and
consumer documentation remain to be delivered. No type-inventory cells change.
