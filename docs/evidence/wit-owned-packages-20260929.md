# Owned WIT installed packages

VO task 1219. This milestone connects the public owned WIT session to the native
build and release paths. The predecessor
[public-session receipt](wit-owned-session-20260929.json) remains unchanged.

The builder authenticates the compiled Lean component and shared runtime,
generates the typed public API and Component Model binary, builds GMP 6.3.0,
and links a Wasmtime 42.0.1 host. The compiler-free packager regenerates all
adapter sources from compiler facts and verifies closed file inventories before
assembling the archive. Reassembly must produce identical archive bytes.

## Installed acceptance

```sh
LEAN_BRIDGE_WIT_OWNED_PACKAGE_TEST=1 \
  node --test --test-concurrency=1 tests/wit-owned-packaging.test.mjs
```

Six tests cover nested values, resource-bearing host callbacks and all 19
scalars, each from ordinary source and independently reviewed declarations.
The tests remove the producer sources and release, install the archive offline,
run independent public C consumers through pkg-config, remove the handoff,
relocate the installation, and run the same consumer through CMake.

The value consumer covers records, sequences, options, results, products,
variants, aliases, recursive values, resource identity, independent leases,
returned closures, malformed inputs, affinity and cleanup. Callback consumers
cover reentry, new resources, expired borrows, typed failures, input-owner
release, conversion limits and closing during a callback. Scalar consumers
check exact integers, signed and unsigned widths, floating-point special
values, UTF-8 and embedded NUL, optional Unit, malformed inputs and limits.

For each value package, 12 loader scenarios cover local and global visibility:
compatible duplicate installations and post-fork rejection, plus a modified
copy of each of the five dependencies. Conflicts must reject session open,
exported calls and cleanup before entering Lean or Wasmtime. Loading a fresh
host in a child with inherited Wasmtime state must also reject. The unchanged
consumer documentation example compiles and prints `42` after relocation.

Rewriting a generated header and its receipt hash must fail regeneration checks.
An unrecorded artifact must fail the closed-inventory check. CI requires all six
tests without skips, retains the complete log and installed reports, and
propagates failures to the WIT support result.

## Scope

The Component Model requires the bundled native host. It is not a standalone
WASI command. The public API exposes typed C values and opaque owners, not raw
Wasmtime resources or caller-owned stores. Package dependencies load
automatically; the archive includes licenses and GMP's corresponding source.

Transferred inputs, owner-anchored borrowed results, retained host callbacks
and asynchronous callables remain open. The broad cross-language support
tables are unchanged pending their final acceptance pass. This receipt makes
no registry-publication, Docker-owned execution or performance claim.

The [machine-readable receipt](wit-owned-packages-20260929.json) retains the
complete final log, installed reports, all source hashes and exact reversible
changes from commit `2ae8ff5cb06fc2b56adc20aa33b10a170b81d3f1`.
