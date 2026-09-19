# C++ exact integers, callbacks and returned closures

Ordinary-source and independently reviewed C++ packages each pass 23,896
installed assertions. Each relocated executable repeats those checks after
removing the package sources and archive handoff. The
[acceptance record](cpp-callables-20260919.json) retains source, consumer,
compiler-model, receipt, executable and archive hashes.

## Installed contract

The independent 60-export fixture applies callbacks once and twice and returns
captured two-argument closures for all nineteen primitives. Additional exports
exercise mixed signatures, multiple callback arguments and expired call borrows.
Lean checks callback identity lemmas. The reviewed contract is written from
independent signatures rather than derived from compiler output.

Each path verifies and relocates its archive, removes the author and build
directories, and installs offline. Consumers compile only C++, using the
prepared headers and libraries. The executable runs with compiler paths
disabled, then runs again beside its relocated libraries after the installed
headers, test sources and handoff archives are removed.

## Exact integers

`Nat` and `Int` map to `boost::multiprecision::cpp_int`. Negative `Nat` inputs
reject before calling Lean, including array elements, record fields, callback
results and returned-closure arguments. Signed values use the same exact C++
type. C++ converts through magnitude limbs internally; the C API keeps its
existing carriers.

Packages include the pinned Boost.Multiprecision and Boost.Config 1.90.0 headers
and Boost Software License. CMake and pkg-config select standalone mode. All
198 upstream files and the dependency receipt are checked against their bundled
sources in both installed paths. No network access or system Boost installation
is needed during package construction or consumption.

Boost documents the [standalone dependency](https://github.com/boostorg/multiprecision/blob/boost-1.90.0/include/boost/multiprecision/detail/standalone_config.hpp)
and its [exact bit import/export operations](https://www.boost.org/doc/libs/develop/libs/multiprecision/doc/html/boost_multiprecision/tut/import_export.html).
The two source commits, archive hashes and header payload digest are retained in
`src/backends/cpp/boost.source.json` and each prepared package's
`share/lean-bridge/boost.json`.

## Checks

- Exact fixed-width endpoints, 16,385-bit integers, binary32/binary64 subnormals,
  signed zero, infinities, NaN, Unicode scalars, UTF-8, embedded NUL and bytes.
- Typed callback and closure arguments/results for all nineteen primitives,
  both captured-value branches, invocation counts and move-only callbacks.
- Seven compile-fail consumers reject wrong inputs, wrong callback signatures,
  borrowed callback results, wrong closure arguments, closure copying and a
  non-void Unit callback result. Diagnostics must point to consumer source.
- Original C++ exception types and payloads survive native cleanup. First
  failure suppresses subsequent callbacks. Nested calls recover after handled
  failures and the native 64-call depth limit.
- Expired callback borrows, negative naturals, invalid Unicode and UTF-8,
  copy-budget exhaustion, wrong-thread calls/close and inherited post-fork
  closures reject. Fresh calls still work afterward.
- Automatic destruction, moves, repeated close, 8,192 successive leases and
  the 4,096-live-lease limit restore the runtime's baseline identity count.
- Allocation failures at successive `operator new` checkpoints cover string,
  bytes, bigint, closure creation and closure invocation. Every checkpoint
  checks that native lease counts return to baseline.
- A compiled generator test closes and destroys a closure from inside its
  active invocation. The active guard keeps the lease alive until return and
  releases it exactly once. A same-thread closure also crosses a shared-library
  boundary with hidden symbol visibility.

The existing C/C++ package suites separately check scalar values, nested arrays
and records, CMake/pkg-config consumers, reproducible archives, mixed packages,
threads and conversion cleanup. The independent Shop and Telemetry corpora
compare exact bigint arithmetic and copied fields with fresh Lean oracles on
both source paths.

Run the installed checks with:

```sh
LEAN_BRIDGE_CPP_CALLABLE_TEST=1 node --test tests/cpp-callables.test.mjs
LEAN_BRIDGE_NATIVE_C_TEST=1 node --test tests/native-c-family.test.mjs tests/native-c-copied.test.mjs
npm run test:type-corpus:cpp
LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES=cpp node --test tests/type-corpus-reviewed-native.test.mjs
```

Local tests use GCC 12.2.0, C++20 and glibc 2.36. Packages declare the production
floor of glibc 2.38; CI runs on Ubuntu 24.04 with that floor.
Typed callbacks are synchronous call borrows. Returned closures are move-only
and retain their creating thread when moved. C++ exceptions are caught before
returning to C and rethrown after C returns; aborts and throwing destructors
follow C++ rules. Shared-object concurrency still requires synchronization.
The 16 MiB conversion budget does not bound the Lean algorithm's working memory
or every C++ allocation. This milestone adds no compound callable, resource,
asynchronous or other-host callable claims.
