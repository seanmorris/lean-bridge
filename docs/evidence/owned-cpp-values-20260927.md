# C++ owned-value call layer

VO 1219. The C++ generator implements resource-bearing values and synchronous
callbacks over the compiler-authenticated C ownership API. The canonical builder
produces prepared C and C++ archives from the same native component for ordinary
Lean sources and independently reviewed contracts.

## Host values

Records retain source field names. Variants have named constructor structs in a
`std::variant`. Arrays and lists use `std::vector`, tuples use `std::pair`, and
options use `std::optional`. `Result<T, E>` distinguishes `Ok<T>` from `Err<E>`,
including when both payloads have the same type. Aliases retain source names.
Recursive or large inline fields use deep-copy `Box<T>` storage. Nat and Int use
Boost.Multiprecision exact integers; negative Nat inputs reject before a Lean call.

Resource leaves have nominal C++ types. Copying a resource wrapper shares its
checked result lease and identity. Copying a containing record or vector copies
its value storage, not the underlying resource. `close()` releases that wrapper;
other owning copies remain usable. `retain()` creates an independently owned
reference through the C boundary.

The generated API owns its per-thread session. Calls reject resources from another
thread or process. Destruction on a foreign thread queues native cleanup for the
creating thread. Thread exit closes the session and releases its registered
owners, including resources whose C++ wrappers outlive that thread.

## Callbacks and returned closures

Exports accept typed lambdas, function objects, or existing Lean closures.
Returned Lean closures support function-call syntax and `retain()`. Mutable host
callbacks keep their mutability when passed through a returned closure.

Callback resource arguments are call-scoped borrows. Copies of those wrappers
expire when the callback returns. Call `retain()` inside the callback to keep a
resource beyond that invocation. Copied strings, integer values, and container
storage do not depend on the borrow, but any resource leaves still do.

The wrapper copies a callback reply into an owned C result before destroying the
callback's local storage. It catches exceptions inside the C trampoline and
rethrows the original exception after C and Lean cleanup. The first failure
suppresses later host invocations in the same call. A nested call has its own
failure state, so catching its exception does not poison the enclosing callback.

Some callback signatures cannot derive a failure-path value from their arguments.
For example, a factory returning an opaque resource requires a real resource as
recovery. Use `with_recovery(callback, recoveryValue)`. The generated constraints
reject missing or incorrectly typed recovery values. A failure never publishes
the recovery value as successful output.

## Validation and cleanup

The wrapper validates every input graph before allocating C views. Input checks,
callback conversions, and final result conversion share cumulative node and
storage budgets for one call. Depth is limited to 128, visits to 262,144, and each
native/storage counter to 16 MiB. These limits do not cap the Lean algorithm's
working memory. The C boundary also applies its own limits.

Result guards clean up partially converted outputs. Callback borrows expire on
both normal return and exceptions. Boolean and enum tags are inspected as bytes
before interpreting their values. Malformed spans, tags, Unicode, integer sizes,
and cyclic or oversized values reject without publishing a partial host result.

## Verification

Run the actual compiled probes:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test \
  tests/owned-cpp-runtime.test.mjs \
  tests/owned-cpp-callables.test.mjs
```

The suites build fresh ordinary and independently reviewed Lean inputs. The
22-export aggregate fixture covers arrays, lists, optional values, both result
branches, tuples, records, variants, aliases, recursive values, and returned
closures. The callback fixture covers explicit retain, expired borrows, local
reply storage, factory recovery, nested exceptions, repeated invocation limits,
and session close during a callback.

The call-layer executables sweep C++ allocation failures through input conversion,
callbacks, and output conversion, then check that bridge allocations and broker
identities return to baseline. AddressSanitizer and UndefinedBehaviorSanitizer
runs are compared with an unsuppressed cold Lean/GMP startup control. Sanitized
and ordinary builds may elide different allocations; each build tests its own
allocation sites and must pass the same functional assertions.

Reports are generated under `build/owned-cpp-runtime/` and
`build/owned-cpp-callables/`. They identify the compiler inputs, generated headers,
consumer source, checks, and sanitizer baseline. These are generated-header
execution tests, not installed-package receipts.

## Prepared packages

The package builder shares one C adapter between both projections and bundles
the matching Lean runtime, GMP 6.3.0 and pinned Boost 1.90.0 headers. C++ CMake
metadata requests C++20 and threads and supplies the standalone Boost definition;
pkg-config supplies matching flags. C and C++ receive distinct CMake targets.

The packager regenerates C++ headers and ownership rules from authenticated IR.
It compares pinned dependency contents, not only caller-provided hashes. Tests
forge callback lifetime rules, generated headers and Boost contents, recompute
their hashes, and require rejection. Reassembling verified inputs produces the
same archive bytes.

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-cpp-packaging.test.mjs
```

The 31-export composition fixture adds boxed `Option Chain` recursion, nested
`Option Bool`, `Option Unit`, exact signed/unsigned integers, floating-point edge
cases and returned higher-order closures. Its independently authored contract
does not import extraction or adapter generation. The C++ consumer includes only
the installed public header, with no private runtime hooks.

The tests remove the author project and producer build before installing either
archive. They run the C++ consumer with pkg-config, remove the handoff and
relocate the package, then repeat with CMake and sanitizers. Lean is unavailable
in each consumer environment. The accompanying C archive runs its existing
resource callback consumer against the same compiled adapter. Reports are written
to `build/owned-cpp-packaging/ordinary.json` and `reviewed.json`.

The [recorded executions](owned-cpp-execution-20260927.json) contain 13 passing
core tests, five package tests and eight C package regressions, all enabled with
zero skips. Each C++ installation passes 577 checks through pkg-config, relocated
CMake and sanitizers; each companion C installation passes 693 checks. The
[source transition](owned-cpp-integration-20260927.json) records exact predecessor
bytes and retains the earlier language receipts unchanged.

This stage does not promote ownership cells in the cross-language audit inventory.
Transfer and anchored-result lowering, other host projections and Wasm ownership
remain part of VO 1219.
