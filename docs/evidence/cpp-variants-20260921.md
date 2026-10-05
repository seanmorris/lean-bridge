# Installed C++ tagged variants

VO1219 adds prepared C++20 packages for concrete, non-recursive Lean inductives.
Each constructor becomes a named struct; its enclosing type is a `std::variant`
of those structs. Empty constructors and Unit payloads remain distinct.
Consumers construct and inspect named alternatives without constructor numbers
or JSON transport. The [machine record](cpp-variants-20260921.json) binds both
source paths to their original archives and installed files.

## Native conversion

Compiler-authenticated constructor metadata generates typed Lean constructors,
branch readers and field getters. The C adapter never reads a Lean object tag
or a constructor-field offset. This works with object-valued variants, unboxed
enums and the compiler's single-constructor representation.

The private C transport uses a validated tag and a union of case payloads.
Validation, conversion and cleanup visit only the active case. Unknown tags
reject before reading payload storage. The existing 16 MiB input/output copy
budget and 32-level type-depth bound still apply. C++ inputs borrow scoped
views; results own their strings, containers and nested values.

Constructor fields use snake_case and retain compiler-disambiguated trailing
underscores. C/C++ keywords receive a trailing underscore, such as `bool_` and
`char_`. Case, field and generated-alternative name collisions reject before
compilation. Source constructor names and field contracts remain in the
installed Binding IR and compiler metadata.

## Installed execution

The independent fixture has thirteen exports, seven variants with eighteen
constructors, and a record containing variants. Ordinary-source and reviewed-IR
builds each install the original archive offline after removing the producer.
The consumer compiles against packaged public headers and libraries. The test
then removes the handoff, consumer source and compiler-tool directory, relocates
the installation, and executes twice with no compiler or runtime override.
All four loaded libraries match their installed receipt; deployed files and the
consumer executable remain unchanged.
An independent rebuild reproduced both source-path archives and every installed
file byte for byte.

Each execution passes 36,091 assertions across 2,372 calls. These cover all
nineteen primitive payloads, 5,121-bit integers, fixed-width and platform-word
limits, IEEE special values, Unicode, embedded NUL and binary data. Lean checks
all nineteen fields independently, including eighteen changed-field negatives.
Other checks cover empty and populated constructors, nested records, Lists and arrays, optional
variants, both result branches, products, single-constructor arithmetic and
Lean-created output variants. Mutation and destruction tests verify independent
payload ownership.

Nine invalid input or budget cases reject and recover. Thirteen injected C++
allocation failures exercise input views and partial result construction;
tracked allocations return to their baseline after each attempt.

## Separate native fault probe

The probe compiles a private copy of the generated adapter against the original
Lean component. It intercepts bridge allocations and can inject an invalid
returned tag. The installed archive is never modified. Its 1,182 assertions
cover 242 allocation failures, seventy invalid input cases, one injected native
tag, inactive poison payloads and valid recovery. Output slots remain unchanged
on failure; all tracked bridge allocations are released. The tag injection is
synthetic; the remaining calls execute the compiled Lean fixture.

AddressSanitizer and UndefinedBehaviorSanitizer report no errors. LeakSanitizer
reports twelve GMP allocations totaling 128 bytes in a startup-only execution.
The full conversion run must produce the identical leak report after normalizing
process IDs and addresses. This checks for additional leaks; it does not claim
that the pinned runtime exits with an empty leak report. Both reports come from
the same executable, and the machine record retains the startup baseline.
The injected tag replaces the helper's result after the helper executes, so the
probe preserves the adapter's Lean reference-count handling.

## Reproduce

Use the [C++ author toolchain](../publish/cpp.md#build-an-ordinary-lean-project),
including a C compiler with address and undefined-behavior sanitizers:

```sh
LEAN_BRIDGE_CPP_VARIANT_TEST=1 node --test tests/cpp-variants.test.mjs
node --test tests/native-variant-contract.test.mjs tests/cpp-variant-evidence.test.mjs
```

CI requires and retains `build/variants/cpp.json`. Local execution uses the
explicit glibc 2.36 test override; the production and CI floor remains 2.38.
Temporary author and consumer directories are removed after each source path.
No registry package was published.

## Scope

This milestone covers C++ copied variant parameters, results and fields on both
source paths. [C/C-GMP acceptance](c-variants-20260921.md) is recorded separately.
The other native host projections, PHP-Wasm and WIT still reject variant APIs. Recursive
values, compound callable payloads and identity-bearing aggregates remain open.
