# Installed recursive Python callbacks and closures

Plan node: 1219. Baseline: `53ccb05a9ad93cebf37c17a5b4ea2415275ee287`.

Python packages now accept finite recursive copied values in synchronous host
callbacks and returned Lean closures. Public types retain constructor names,
recursive aliases and typed callable signatures. Consumers install the original
wheel and import the generated package. They do not build Lean or handle native
pointers.

## Installed acceptance

The gate compiles 33 exports and 18 callback signatures independently from
ordinary Lean source and reviewed Binding IR. Each path produces a PyPI-only
release. The producer is removed before installation, the installed environments
are relocated, and the release handoff is removed before execution.

Each original wheel is installed offline in three environments:

- Python 3.11 with `typing_extensions` 4.6.0.
- Python 3.11 with `typing_extensions` 4.16.0.
- Python 3.12 with standard-library recursive aliases.

Each installation passes 925 recursive checks, 720 calls and 508 rejection
checks, plus the unchanged eight-shape consumer's 32,236 checks. Tests cover
recursive trees, callback-only nested aliases, independent copied results,
callback exceptions, malformed results, expired borrows, thread affinity and
depth boundaries. The exact published Lean example compiles in the producer;
the published Python example passes strict mypy and executes from the installed
wheel. Nine invalid call sites produce ten expected typing errors.

In-memory fault probes inject 9,984 `MemoryError` and `BaseException` failures
across callback, repeated-callback, closure creation, creation-and-call, and
held-closure call paths. They check 4,616 result clears, 21,032 scope closes and
29 malformed native values. Every checkpoint restores the live identity count.
Malformed native output retires the runtime. The installed files remain unchanged.

Lifetime tests reject a retained closure from 16 replacement threads after its
creator exits. The runtime accepts 4,096 owned closures, rejects the next one,
and permits a replacement after one closes. Explicit close, repeated close,
deferred close during an active invocation and finalization release their captures.

The previous primitive and acyclic structured installed-package gates also pass
again on both source paths. These checks use their original fixtures and public
consumers.

## Bounds and support records

The recursive profile allows 128 value levels, 262,144 visited nodes and a 16 MiB
native copy budget per call. Python conversion storage has a separate 16 MiB
accounted budget. Native reentry is bounded to 64 calls. Closures share the
runtime's 4,096 identity slots. These limits do not bound all Python allocator
overhead or Lean working memory.

The installed acceptance uses Linux x86-64, GIL-enabled Python and explicitly
checked manylinux 2.36 wheels. It does not change the production build's default
glibc floor. Resource-containing copied fields, nested callable identities,
asynchronous delivery, free-threaded Python and post-fork calls remain outside
this profile.

Inventory 0.99.0 adds exactly four cells: Python recursive callback input and
result on both source paths. All 6,562 cells remain classified; 4,794 have passed
installed execution. No other support cell changes.

The [execution record](python-recursive-callables-20260925.json) retains terminal
logs, original package identities, documentation hashes, installed files and
per-interpreter results. The [integration record](python-recursive-callable-integration-20260925.json)
records reversible source changes and authenticates the complete predecessor
history without replacing its receipts.

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_PYTHON_RECURSIVE_CALLABLE_TEST=1 \
  node --test tests/python-recursive-callables.test.mjs
node --test tests/python-recursive-callable-contract.test.mjs
node --test tests/python-recursive-callable-evidence.test.mjs
```
