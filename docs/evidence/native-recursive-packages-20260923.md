# Installed recursive C and C++ packages

VO 1219. Ordinary Lean source and independently reviewed contracts build prepared
C11 and C++20 archives containing recursive copied values. Consumers use the
public headers, CMake or pkg-config. Packages load their included shared Lean
runtime automatically. Neither consumer needs Lean or the author's source tree.

The C API exposes named structs and constructor tags, typed borrowed input
children, GMP integers and independently owned outputs. Initialize outputs
before calling. Success replaces an initialized result; failure preserves it.
Graph variants start without an active constructor and require `_select`.
Clear or select only an owning root, not one of its borrowed nested views.

C++ exposes standard containers, named constructor structs and deep-copy
`Box<T>` values. It returns independent owned results and releases native output
on conversion or allocation failure. Recursive variants store their named
alternative in `value`. See the [C](../consume/c.md#recursive-copied-values) and
[C++](../consume/cpp.md#recursive-copied-values) examples.

## Bounds and failure

Calls share 128 levels, 262,144 visited nodes and 16 MiB native copied storage
across inputs and output. A separate 16 MiB budget accounts for host conversion
storage. These limits do not bound Lean working memory. Cycles, invalid fields
and exceeded bounds report `INVALID_ARGUMENT`. Bridge allocation failures and
unavailable runtimes report `UNEXPECTED_ERROR`.

Malformed native results retire the shared runtime. Already owned values remain
clearable, and later calls reject. C++ allocation failures propagate
`std::bad_alloc`. GMP keeps its default fatal allocation policy; the bridge does
not replace GMP's allocation hooks.

The earlier [C++](cpp-recursive-conversions-20260922.md),
[C/GMP](gmp-recursive-conversions-20260923.md) and
[runtime retirement](native-retirement-20260923.md) records cover allocation
injection, partial cleanup, fatal sanitizer checks and compiled carrier failures.
Those checks remain distinct from the installed consumer assertions below.

## Installed checks

Both source paths compile eighteen exports. Each C consumer passes 1,425 checks;
each C++ consumer passes 270. The fixture covers all nineteen primitives inside
recursive trees, 1,001-bit integers, mutual recursion, Lists, arrays, aliases,
nested options/results, products, empty records, Unit versus empty constructors,
a 255-field recursive constructor, depth limits and uninhabited types.

The suite removes the producer's source and staging before installation. It
verifies the relocated package-set receipt and archive contents, compiles using
pkg-config and CMake, and rejects an incorrectly typed consumer. It then copies
only the executable and shared libraries to a new directory, removes the headers
and archive handoff, and executes again with compiler tools absent from `PATH`.
The dependency checks verify packaged GMP/Boost files; the release packager
rejects a changed graph-layout digest.

A separate C++ probe checks every private boundary status against public error
codes, rejects malformed output, and verifies retirement before result publication.
The [receipt](native-recursive-packages-20260923.json) records the installed
archives, source hashes, consumer results and a repeated build's archive identities.

Fresh installed C and C++ callable regressions also pass on both source paths.
The shared build changes pass a separate [Java/Kotlin collection regression](native-recursive-jvm-regression-20260923.json):
158,171 Java assertions and 158,334 Kotlin assertions per source path, including
679 injected conversion failures per consumer. Public generated classes,
observations and guide examples match the original Kotlin receipt. The new record
binds current native libraries and archives separately; historical receipts remain
unchanged.

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_GRAPH_PACKAGE_TEST=1 \
  node --test tests/native-graph-package.test.mjs
```

The recorded host and archive floor are Linux x86-64 with glibc 2.36. Other
recursive profiles, structured callable payloads and explicitly owned resource
aggregates remain required. This milestone does not publish to a registry.
