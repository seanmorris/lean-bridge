# Prepared Rust packages with resource-containing values

VO 1219. Ordinary Lean source and independently reviewed version-4 contracts
produce installed Cargo packages with explicit ownership. Consumers use named
structs, enums, aliases, `Vec`, `Option`, `Result`, tuples and recursive `Box`
fields. Resource leaves retain their identities through checked leases.

The package embeds its native libraries and loads them automatically. Consumer
builds use an empty Cargo home, vendored Rust dependencies and a linker that
rejects C compilation. They need no Lean toolchain, GMP installation, native
declarations or runtime path configuration.

## Checked behavior

Each source path passes 596 independent installed-consumer checks, followed by
the same checks after retaining only the executable and deleting the producer,
crate source, dependencies and handoff directory. Tests cover mixed records,
all fixture constructors, empty containers, nested options, exact integers,
Unicode and NUL, boxed recursion, higher-order closures and mutable callbacks.
The reviewed build also supplies C and C++ packages from the same component and
adapter. Their installed consumers pass 693 and 577 checks respectively.

Resource clones share a checked lease; container storage copies independently.
Callback resource borrows expire at callback return, including cloned wrappers.
Explicit retention survives that return. Resource types and closures remain
thread-confined. Rust rejects wrong resource kinds, `Send`/`Sync` misuse and
callbacks missing typed recovery. Runtime checks reject closed resources and
post-fork use. Callback errors and panic payloads return after native cleanup.

Native boundary probes pass 3,025 checks per source path, including 342 injected
Rust conversion errors or panics and 254 native allocation failures in their
mixed-value loops. Additional callback failure cases cover reentry, reply
conversion and native allocation failure. Lease probes pass 184 checks and
four native allocation failures per source path. All finish with zero live
bridge allocations and resource identities. Malformed-result tests fail after
adopting a real native lease and after publishing an output owner.

Package tests reject altered lifetime rules, generated Rust, C/GMP ABI assertions
and embedded libraries, even with recomputed file hashes. Installed executables
reject corrupted embedded bytes and an unverified preloaded Lean runtime. The
consumer documentation example compiles and runs from each prepared crate.

## Limits and scope

Calls enforce depth 128, 262,144 visits and separate 16 MiB Rust/native storage
budgets. These bounds do not cover Lean working memory or every allocator
overhead. Rust and GMP retain their normal fatal allocator-exhaustion policies.
Conversion-failure injection does not demonstrate recovery from process abort.

This projection targets Rust 1.90 or newer on native Linux x86-64. Cargo-only
builds bundle GMP without a public C package or Boost. The records retain the
compiler inputs, generated source hashes, package receipts, pinned dependency
closure and test output for both source paths. Existing receipts remain unchanged.

Transfer, anchored results, other host ownership projections and Wasm remain
separate work. This milestone does not promote generic type-matrix cells.
