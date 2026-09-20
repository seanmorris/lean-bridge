# Compiled Rust Lists

VO1219 adds copied Lean `List` parameters, results and record fields to prepared
Cargo crates. Both ordinary-source and independently reviewed builds compile the
same 27-export List catalog used by npm, C/C++ and Python.

Inputs borrow slices. Results and record fields use owned `Vec<T>` values.
Lists preserve order, duplicates, empty values and nesting with arrays, options,
results, binary products and acyclic records. All nineteen primitive element
types retain their checked Rust representations. List and Array keep distinct
Binding IR constructors and private native types.

Generated Lean helpers construct Lists and perform bounded, tail-recursive
output walks without inspecting cons-cell tags or offsets. Rust conversions and
native copies each enforce a 16 MiB accounting budget; type nesting stops at 32.
The limits do not bound Lean working memory or every Rust allocation. RAII
releases temporary buffers and native results after errors or unwinding. A
process abort, including an aborting allocation failure, cannot run destructors.

## Installed validation

```sh
LEAN_BRIDGE_RUST_LIST_TEST=1 node --test tests/rust-lists.test.mjs
node --test tests/rust-list-contract.test.mjs
```

The [machine-readable record](rust-lists-20260920.json) binds the independent
signature catalog, crates, source identities, consumer and fault-probe hashes.
Each crate installs offline with locked dependencies after deleting its producer
source/build tree. Consumers need no Lean compiler or C compilation. The compiled
consumer also runs after removing the crate and dependency sources, with compiler
and runtime override paths unavailable.
Each installed consumer and its source-free rerun pass 34,130 assertions.

The consumer checks nineteen primitive elements, 5,121-bit integers, Unicode/NUL,
IEEE special values, nested copied types, independent results, empty Lists at
every depth and 24-level values. It checks a 30,000-element result, copy-budget
failures followed by recovery, and four concurrent callers. Independent function
pointer types verify the public signatures.

Twelve invalid programs must fail at their own source locations with the expected
Rust diagnostics. Private probes cover 444 allocation-error and panic injections
per build path, visiting every conversion checkpoint for seven calls and
requiring zero live scratch owners and native output
cleanup before a successful follow-up call. Malformed lengths, missing or
misaligned pointers and invalid nested outputs reject before invalid reads.
These probes instrument an installed crate copy; the recorded archive is unchanged.

This adds six installed type/position/path cells for Rust. The accepted profile
is Rust 1.90+ on Linux x86-64. Local checks use glibc floor 2.36; CI retains 2.38.
List callback payloads remain unsupported, and copied values cannot contain
resources or callbacks. Other unimplemented List hosts remain separate work.
