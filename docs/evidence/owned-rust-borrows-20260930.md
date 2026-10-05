# Rust borrowed results

Prepared Cargo packages preserve function results anchored to an input's original
owner. `Value<T>` owns the complete result, including empty containers and
constructors. `get()` validates the owner and returns `Result<&T, Error>`.
Clones share immutable result storage. Closing one clone leaves other owners
usable; borrowed results do not keep their anchor alive. Releasing or transferring
that anchor expires its borrowed descendants.

`retain()` and `copy_value(&host_value)` create independent owners. Previously
extracted references do not revalidate ordinary copied field reads; resource
operations still validate their own lifetime. `try_equal()` and `same_identity()`
report expiration. `PartialEq` returns false for expired values and compares
canonical resource identity for valid values. These wrappers are neither `Send`
nor `Sync`, and inherited post-fork resources reject calls.

Consuming calls take `&mut Value<T>` and move the original C owner slot, including
for empty values. Preflight failure preserves ownership. Native handoff expires
aliases and borrowed descendants before callbacks can reenter. Later errors and
panics do not restore the input. Borrowed roots cannot transfer without explicit
retention, and a call cannot consume its result anchor or an ancestor of it.

## Acceptance

```sh
source scripts/env.sh
npm run test:owned-rust-borrows
```

The runtime and installed test files also ran separately with
`LEAN_BRIDGE_OWNED_RUST_BORROW_TEST=1`. The [receipt](owned-rust-borrows-20260930.json)
records the actual commands and logs. Ordinary and independently reviewed APIs
each compile 26 exports, including 19 anchored results and four consuming calls.
Each runtime probe passes 3,713 checks, including allocation failures, panic
unwinding, callback escape, transitive expiration, recursive values, canonical
identity and empty-owner consumption. No bridge allocations or identities remain.

Four malformed consumers fail to compile: raw anchors, immutable transfers,
`Send` and `Sync`. A borrow-only API compiles separately. Four broken generated
implementations compile and then fail the independent runtime oracle: missing
whole-owner validation, discarded empty owners, escaping callback views and
pointer-based resource equality.

Each installed path passes 440 Rust checks and 407 shared C++ checks. The test
deletes the author source and producer output before installing the archive into
an offline Cargo consumer with an empty Cargo home and no Lean or C compiler.
The documentation example prints `42`. After removing the installed packages
and handoff, the relocated executable repeats all 440 Rust checks. Eleven altered
anchor-contract fields and three incapable readers reject. Archive reassembly
reproduces the same bytes; the test does not independently rebuild Lean.

Rust's ownership contract and binding manifest use version 3. Its compiled
projection and Cargo package receipts use version 4. The shared native model is
version 9 and public C adapter is version 5. Unanchored generated APIs keep their
existing representation and versions. CI requires six enabled tests with no
skips and retains both source paths' runtime and installed reports.

The source-history receipt preserves earlier receipt bytes. Type-table changes
refresh hashes without promoting support cells. This milestone also includes
both the C++ and Rust borrow modules in the filtered Nix engine's source list.

## Remaining work

Nine further consumer binding groups need borrowed-result projections. Docker
installed acceptance and the final documentation, support-matrix and CI audit
remain open. Receiver anchors and callback-result anchors are outside this
milestone. No package was published to a registry.
