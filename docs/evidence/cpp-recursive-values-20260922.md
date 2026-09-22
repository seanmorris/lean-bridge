# Owned C++ recursive values

VO 1219, 22 September 2026. The
[C++ graph value generator](../../src/backends/cpp/copied-graph-values.mjs)
now emits owned C++20 declarations for the finite copied type graph. This is
host-value acceptance. It does not yet enable recursive C++ package builds or
promote installed coverage.

Records retain named fields. A variant has named constructor structs and a
`std::variant` member named `value`. Arrays and lists use `std::vector`; products
use `std::pair`; options use `std::optional`. Results keep distinct `Ok<T>` and
`Err<E>` alternatives. Aliases remain transparent. Nat and Int use the same
pinned standalone Boost.Multiprecision types as existing C++ packages.

`Box<T>` provides indirection for direct recursive fields and large inline
values. Copying a box duplicates its contents; moving transfers ownership.
Copies of a graph share no boxed nodes. Failed copy assignment leaves the
destination unchanged. Optional recursion uses `std::optional<Box<T>>` without
an extra box around the option. A default box is empty, and dereferencing it
throws `std::logic_error`; it is not a default inhabitant of a Lean type.

The generator checks public name collisions before emitting headers. It uses
forward declarations and finite structural aliases, retaining shared type
definitions instead of expanding their trees. A 700-alias fixture stays below
200,000 generated characters. That check measures generation size, not compiler
acceptance of arbitrarily deep template instantiations.

Run the checks with:

```sh
node --test tests/cpp-copied-graph-values.test.mjs
```

The independent C++ caller compiles and executes with ordinary flags and with
AddressSanitizer plus UndefinedBehaviorSanitizer. Checks cover 127-layer copies,
independent mutation, mutual recursion, optional backedges, 1,001-bit integers,
embedded NUL text, Unicode scalars, machine-word endpoints, empty records,
distinct nullary and Unit-bearing constructors, a 255-field recursive variant,
empty and moved-from boxes, and cleanup after a throwing copy constructor.

The remaining C++ integration needs bounded input views, output conversion,
status/runtime failure handling, prepared archives and ordinary/reviewed
installed consumers. The [compiled native graph components](native-graph-components-20260922.md)
supply the checked Lean implementation and C conversion underneath those APIs.
