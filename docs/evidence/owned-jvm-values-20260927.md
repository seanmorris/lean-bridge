# Owned JVM layouts and Java declarations

VO task 1219. This development milestone adds private FFM layouts and public
Java value declarations. It does not admit owned graphs to Maven packaging.
The earlier JVM runtime receipt remains unchanged.

The native layout suite passed five tests with no skips. Both ordinary source
and independently reviewed IR produced matching C and Java FFM layouts:

- Composed values: 205 C assertions and 226 Java assertions per path.
- All 19 scalar types: 93 C assertions and 90 Java assertions per path.

The checks cover sizes, alignment, field offsets, recursive indirection,
resource and closure pointers, callback descriptors, and the read-only GMP
integer layout used by the native C ABI.

The Java declarations suite passed two tests with no skips. An external
consumer compiled against class files after the producer sources were removed.
Its 26 value assertions cover deep equality, nested options and results, empty
branches, recursive values, cycle and depth limits, and opaque resource classes.
Eleven invalid consumer programs failed compilation, including raw-handle
access, forged resources, incorrect field and callback types, asynchronous
callback results, and extending closed variants.

Run the suites with LEAN_BRIDGE_OWNED_NATIVE_TEST=1:

    node --test tests/owned-jvm-layout.test.mjs
    node --test tests/owned-jvm-values.test.mjs

The tests select the pinned Java 22 tools and native Lean compiler through the
existing fixture harness. No native library is loaded by the public-declaration
consumer.

Bounded host/native converters, separate Kotlin metadata, typed native calls,
authenticated loading, and installed Maven acceptance remain to be implemented.
This milestone makes no new installed-package or type-surface support claim.
