# Rust closed value-index checked records

This promotion records four installed Rust crate selections from GitHub Actions
run `39379254943`, artifact `12245482092`. The immutable
[archive](checked-record-value-index-rust-20261020/index.json) authenticates
ordinary Lean source and independently reviewed Binding IR, with full and
standalone result-only APIs.

The full API covers top-level copied checked-record parameters and results. The
result-only API covers results only. All routes reproduce the complete crate
from two author roots, remove author roots, install offline from an authenticated
vendored dependency closure, relocate the installation, and replay the unchanged
caller before retaining only its executable for a third run.

The run used Rust and Cargo 1.90.0 on Ubuntu 24.04 with Linux x64/glibc 2.39
and a glibc 2.38 crate floor.

The fixture covers closed `Bool`, `String`, and `Nat` indices: both booleans,
the empty and Unicode strings, zero, and a Nat wider than 64 bits. Generated
structs expose payload fields only; `BigUint` represents every Nat payload.
Invalid closed-index values fail without changing caller data, and a later valid
call succeeds. Proof fields never cross the Rust boundary.

This promotion covers only the four named top-level cells. It does not promote
fields, callbacks, owned values, open or opaque indices, other index kinds,
generic or zero-payload records, or broader dependent payloads.
