# WIT/WASI closed value-index checked records

This promotion records four installed WIT/WASI component selections from
GitHub Actions run `39373895062`, artifact `12243086792`. The immutable
[archive](checked-record-value-index-wit-20261020/index.json) authenticates
ordinary Lean source and independently reviewed Binding IR, with full and
standalone result-only APIs.

The full API covers top-level copied checked-record parameters and results. The
result-only API covers results only. All routes reproduce the complete component
archive from two author roots, remove author roots, install offline, compile one
unchanged public C caller, remove its source, relocate the installation, and
replay the caller binary through Wasmtime.

The run used Ubuntu 24.04 with Linux x64/glibc 2.39 and a glibc 2.38 package
floor, Wasmtime 42.0.1, and wasm-tools 1.245.1. Each selection executes before
and after physical relocation.

The fixture covers closed `Bool`, `String`, and `Nat` indices: both booleans,
the empty and Unicode strings, zero, and a Nat wider than 64 bits. Generated
WIT records expose payload fields only; Nat payloads use exact little-endian
`list<u32>` limbs. Malformed Nat inputs and invalid checked records fail without
changing caller data, and a later valid call succeeds. Proof fields and index
metadata never cross the component boundary.

This promotion covers only the four named top-level cells. It does not promote
fields, callbacks, owned values, open or opaque indices, other index kinds,
generic or zero-payload records, or broader dependent payloads.
