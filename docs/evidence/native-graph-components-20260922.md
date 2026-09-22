# Compiled native graph components

VO 1219, 22 September 2026. Ordinary Lean source and an independently reviewed
contract now build recursive copied exports into a verified native shared
library. This extends the [native transport checks](native-recursive-transport-20260922.md)
through the real component builder, runtime broker and artifact verifier.
Installed C/C++ package acceptance remains separate.

## Compiler and artifact contract

The [native graph model](../../src/build/native-graph-model.mjs) retains the
compiler's finite nominal type table. Ordinary components use model version 4;
reviewed components use version 5 and reconcile their independently authored
Binding IR against fresh compiler metadata. Both use the 64-bit little-endian
native profile. Their stored models contain neither a Wasm dispatch name nor a
32-bit frame layout.

Every copied export in a graph component uses total, typed Lean carrier helpers.
The generated C header declares their signatures, including aliases and empty
constructors. The C compiler checks these declarations against Lean's generated
definitions. Lean checks construction, matching and field access; generated
helpers contain no `unsafe`, unchecked casts, `partial`, `sorry` or axioms.

The artifact verifier reconstructs the model and helpers from recorded compiler
metadata, authenticates the selected source and reviewed contract, and checks
the compiled library, headers and receipts. Component receipts also bind the
[constructor allocation guard](native-allocation-guard-20260922.md).

Compilation and artifact reading require an explicit internal graph capability.
Existing host adapters reject these components until they implement the graph
contract. A rejected build leaves no output directory. Non-graph model and
adapter generation remain unchanged.

## Executed component acceptance

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_RECURSIVE_TEST=1 \
  node --test --test-concurrency=1 \
  tests/native-graph-model.test.mjs \
  tests/native-recursive-transport.test.mjs \
  tests/native-allocation-guard.test.mjs
```

The component test builds the same eighteen exports from ordinary source and a
separate reviewed contract. It verifies each component, compiles the independent
C stress caller against the component's actual header, and links the caller to
the shared library and runtime broker. Each source path passes 169,840 checks.
Both produce the same component binary:

```text
aa2db3227555cc4a790a09a6364955b64a23999ae5822cf9a8dd2968686da112
```

Checks cover all nineteen primitives, recursive and mutually recursive values,
aliases, nested containers, empty records, distinct nullary and Unit-bearing
constructors, malformed inputs and results, and allocation-failure cleanup.
The wide fixture retains 256 carrier arguments and 127 recursive layers.
The C compiler reports each recursive decoder stack frame below 1 KiB.

The combined compiled suite passes all ten tests. Repository checks pass 1,846
contract tests with 72 explicit toolchain skips, 78 documentation tests and 111
site tests. Lint, repository and site typechecks, and the production site build
also pass. Historical installed-package receipts remain unchanged.

## Remaining package work

The test calls the compiled native conversion directly; it does not install a
public C or C++ package. Public adapters still need status translation, the
runtime policy for malformed results, host value APIs and installed acceptance
on both source paths. Other host projections, structured callback payloads and
explicitly owned resource aggregates remain open. This milestone does not
promote any installed type-coverage cells.
