# Compiled C and C++ Lists

VO1219 adds copied Lean `List` inputs, results and record fields to prepared C
and C++ packages. Both ordinary-source and independently reviewed builds compile
the same 27-export Lean fixture.

C uses typed `<prefix>_list_<element>_span` structs with `data`, `length`, `owner`
and `release` fields. C++ uses owned `std::vector<T>`, including
`std::vector<bool>`. Lists and arrays remain distinct in Binding IR and generated
C types. Their elements can contain all nineteen primitives, arrays, acyclic
copied records, options, results, binary products and other Lists.

Generated Lean functions convert between typed arrays and Lists. C does not read
cons-cell tags or constructor offsets. The tail-recursive output walker stops
after 2,097,153 entries on native 64-bit targets. The extra entry forces a
copy-budget failure if the result exceeds the limit; the adapter never returns a
truncated prefix. Intermediate arrays are released on success, empty output,
allocation failure and nested conversion failure.

Inputs and outputs share a 16 MiB conversion budget. Sequence storage charges at
least one native pointer per element, plus copied payloads and ownership headers.
The GMP facade also budgets its public/private conversion. Type nesting stops at
32. These limits do not bound Lean's working heap. Returned values own copies;
mutating an input or one returned byte buffer cannot change another result.

C callers follow the package's initialization and cleanup contract. GMP packages
provide `_init` and `_clear` functions and replace initialized outputs on success.
Other packages use zero-initialized outputs and require clearing before reuse.
Failed conversions leave the caller's output unchanged. C++ wrappers clean up
automatically and report boundary failures through the generated `Error` type.

## Installed validation

```sh
LEAN_BRIDGE_NATIVE_LIST_TEST=1 node --test tests/native-lists.test.mjs
node --test tests/native-list-contract.test.mjs
```

The [machine-readable record](native-lists-20260920.json) binds the independent
signature catalog, archive hashes, source identities and generated consumer
hashes. Each package installs offline after deleting its producer source and
build tree. Consumers use only the packaged headers, libraries and pkg-config
metadata; Lean and runtime overrides are absent from consumer PATH.

Each source path passes 31,077 C checks and 30,942 C++ checks, plus 323 private
native allocation-failure checks and 23 GMP facade checks.

The suite checks all nineteen primitive element types, empty Lists, element
order, duplicates, mixed List/Array nesting, branch payloads, record fields,
24-level nesting, exact large integers, native-width integers, Unicode/NUL,
signed zero, NaN, infinities and independent byte copies. A 30,000-element result
checks the iterative path. Over-budget results and malformed inputs reject,
followed by successful calls on the same runtime.

Separate native and GMP probes fail each copied-output or facade allocation in
turn, require zero outstanding tracked allocations, and check unchanged outputs
and repeated cleanup. They do not replace Lean's or GMP's process-wide allocator.

This milestone adds twelve installed type/position/path cells across C and C++.
Other native List hosts and PHP-Wasm remain separate work. Copied Lists cannot
contain resources or callbacks; List callback parameters and results still reject.
The local test uses glibc floor 2.36. CI retains the supported 2.38 floor.
