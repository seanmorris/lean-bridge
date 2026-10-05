# Installed Rust copied aliases, 21 September 2026

Prepared Cargo crates export 27 named copied aliases over all nineteen primitive
types, chains, records and nested containers. Public `type` declarations preserve
names in signatures, compound targets and fields. Rust aliases share their
target's type; they introduce no newtype or runtime wrapper. String and sequence
inputs keep `&str` and slices. Other aggregate inputs borrow their alias. Results
own their copied values. Generated-name collisions fail before packaging.

## Installed checks

The unchanged native alias Lean fixture runs through both ordinary-source
analysis and independently authored reviewed IR. Both compiled contracts must
match the independently specified names, targets and signatures. Each archive
is installed after its producer and staging directories have been removed.
Cargo starts with an empty private home and resolves its pinned dependency
closure offline. Its PATH exposes only a linker wrapper that rejects C and
assembly compilation, plus the linker executable. Downstream users compile Rust,
not Lean or a C extension.

Each public consumer passes 1,278 checks covering all nineteen aliases, exact
5,121-bit integers, machine-word endpoints, IEEE float behavior, Unicode and
NUL, alias chains, return-only aliases, records, nested List/Array values,
all three nested Option Unit states, both Result branches, copy independence,
conversion limits and recovery. Lean independently checks nineteen record fields;
eighteen changed non-Unit fields each cause that check to fail. Four threads
also call the copied APIs independently.

Twelve separate invalid programs fail at their own source locations with the
expected Rust diagnostic. Cases cover wrong scalar and container payloads,
negative Nat input, missing borrows, record fields, domain versus bridge errors,
and fixed-width and platform-word overflow. The positive consumer compiles with
warnings denied.

Private tests inject 202 conversion errors or panics across aliased records,
Lists, large integers and Results. Every probe releases scratch and clears its
native output, then successfully calls Lean again. Malformed native flags,
UTF-8 and characters fail; inactive branches do not read invalid pointers.
The installed package files are restored and rechecked against their receipt.

The compiled consumer moves outside its Cargo project. The test deletes that
project, including crate sources, dependencies and build products, then runs
the executable twice with no compiler or Cargo access. Both repeats perform
the same 1,278 checks. Each process removes its normal-exit loader files.

## Reproduce

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_RUST_ALIAS_TEST=1 node --test tests/rust-aliases.test.mjs
node --test tests/rust-alias-contract.test.mjs
```

The local host uses glibc 2.36 through the existing test override. Production
builds and CI retain the glibc 2.38 floor. The report is
`build/aliases/rust.json`; the [source-bound receipt](rust-aliases-20260921.json)
records both archives, installed files, dependencies and consumer hashes.
Both source paths contain identical compiled native libraries. CI requires
the installed report and uploads it with the other Rust observations.

The settled-source repeat reproduced both crate archives byte-for-byte. Existing
installed callback, compound and List suites pass 35,890, 5,311 and 34,130 public
checks per source path, respectively. Their rejection, cleanup and source-free
execution checks also pass. Comparing the previous generator against the new
one produces byte-identical files for the independent alias-free callback and
List contracts.

Validation also passes 1,548 contract tests with 66 explicitly gated skips,
76 documentation tests, 111 site tests, repository and site type checks, lint,
generated-reference checks and the production site build. All four ordinary
Rust package regressions pass with the explicit Rust 1.90 toolchain, including
offline execution after binary relocation and compiler-failure cleanup.

Inventory 0.48.0 promotes only six Rust alias cells: parameter, result and field
on both source paths. Historical archive inventories remain unchanged. Native
variants, recursive values, compound callable payloads and explicitly owned
identity-bearing aggregates remain open under VO1219 and VO1221.
