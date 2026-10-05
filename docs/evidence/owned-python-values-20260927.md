# Python owned values and callbacks

Python conversions now execute against ordinary Lean compilation and
independently authored reviewed IR. Both paths pass on Python 3.11.16 with
typing_extensions 4.6.0 and 4.16.0, and Python 3.12.14 with standard-library
type aliases. This milestone does not enable prepared wheel admission or
promote installed type-surface cells. VO1219 remains open.

## Implemented behavior

The generated API preserves nominal resource types, frozen record and variant
dataclasses, aliases, arrays, Lists, binary products, Option, Except and recursive
values. None, Some(None) and Some(Some(None)) remain distinct. All nineteen
primitive types compose with resource-bearing fields. Nat and Int preserve
arbitrary precision; the scalar fixture checks independent Lean-constructed
values and Lean-side inspection, not just a round trip.

Conversions enforce depth 128, 262,144 visits, 16 MiB of native conversion data
and 16 MiB of accounted Python storage. They reject cycles, invalid constructors,
invalid scalar values, overflowing spans and malformed GMP metadata. Compiled
C probes check every generated value and callback descriptor's size, alignment
and field offsets against ctypes. A malformed native result retires the runtime.
Allocation and validation failures preserve ordinary runtime use.

Synchronous Python callbacks receive copied containers with borrowed resource
leaves. Those borrows expire on return; explicit retain() creates independent
ownership. Replies are snapshotted into a C-owned result while borrows are live.
C releases that result even when Python fails after publishing it. The original
Python exception reaches the caller after native cleanup. Returned Lean closures
support invocation, retention, closure arguments and higher-order callback
parameters. Borrowed host callbacks cannot escape through a returned closure.
Callbacks needing a typed failure-path value use with_recovery(). Failure never
publishes that recovery value as a successful result.

Generated stubs cover the public functions, records, constructors, resource
methods and higher-order calls. Pinned mypy 2.3.1 accepts the strict positive
fixture and reports thirteen diagnostics for eleven invalid operations in each
Python environment. Those failures include wrong callback results and omitted
required recovery values.

## Executed acceptance

`build-owned-python-runtime-values-recorded.log` passed 9/9 tests with no skips
in 214,684 ms. Each source path ran the following checks in each of the three
value-conversion environments:

| Probe | Assertions | Python allocation failures | Native allocation failures |
| --- | ---: | ---: | ---: |
| Mixed owned values | 604 | 104 | 110 |
| Malformed owned result | 216 | n/a | n/a |
| Host and higher-order callbacks | 392 | 71 | 101 |
| All nineteen primitives | 353 | 30 | 23 |

Every probe ends with zero live bridge allocations and zero native identities.
Failure tests retain exception tracebacks while asserting cleanup. Callback
resource wrappers expire on success and failure. Repeated callbacks hit the
shared conversion limit after 819 invocations and leave the next call usable.

The scalar and callback Python sweeps first measure a successful conversion's
allocation checkpoints, then fail each checkpoint and verify cleanup. The scalar
fixture has exactly thirty checkpoints; an earlier test incorrectly required
more than thirty by borrowing a threshold from the larger mixed fixture.

The same command reran the ownership foundation: 324 assertions on Python
3.11.16 and 325 on 3.12.14 per source path, including foreign-thread finalization,
thread-exit cleanup, fork rejection and partial-wrapper rollback.

Reproduce with:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 \
LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/absolute/path/to/python-typing-wheels \
LEAN_BRIDGE_COLLECTION_MYPY_PYTHON=/absolute/path/to/mypy-environment/bin/python \
node --test tests/owned-python-runtime.test.mjs tests/owned-python-values.test.mjs
```

The adjacent JSON retains the executed reports, compiler-normalized Binding IR
and source hashes. Regenerating from those inputs reproduces the recorded
Python value and conversion sources exactly. Runtime
reports live under `build/owned-python-runtime`; value and callback reports live
under `build/owned-python-values`.

## Remaining delivery

The package source generator connects the typed API, automatic native loader,
runtime, ABI assertions and binding manifest. Its two source-contract tests
pass; these are not installed-wheel acceptance. The wheel builder, authenticated
adapter receipt integration, source-free pip installation, runtime-conflict and
tamper checks, catalog/CI registration, and consumer documentation still need
delivery before this Python milestone is release-ready.

The full task also retains the remaining host ownership projections,
transferred and anchored lifetimes, and Wasm ownership support.
