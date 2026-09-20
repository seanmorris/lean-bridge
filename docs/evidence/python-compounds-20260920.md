# Compiled Python options, results and products

VO1219 adds `Option`, `Except` and nested binary products to prepared Python
wheels. Ordinary-source and independently reviewed-IR builds compile the same
64-export Lean fixture. Payloads can use all nineteen primitives, arrays,
acyclic copied records and these constructors within the 32-level type limit.

| Lean | Python |
| --- | --- |
| `Option T` | `Option[T] = Some[T] \| None` |
| `Except E T` | `Result[T, E] = Ok[T] \| Err[E]` |
| `A × B` | `tuple[A, B]` |

`Some`, `Ok` and `Err` are generated frozen dataclasses with a `value` field.
They support type parameters, ordinary equality and Python pattern matching.
`None`, `Some(None)` and `Some(Some(None))` preserve all states of nested Unit
options. Success and error remain distinct when payload types match. Domain
errors return `Err`; boundary failures raise exceptions. Products require an
exact two-element tuple and retain their binary nesting. Arrays still accept
lists or tuples and return tuples.

The adapter reuses the typed Lean constructor and projection helpers from the
[native compound implementation](native-compounds-20260920.md). Private ctypes
structures describe the C boundary, not Lean object offsets. No constructor
numbers, pointers, runtime configuration or serialization enter the public API.

## Installed validation

```sh
LEAN_BRIDGE_PYTHON_COMPOUND_TEST=1 node --test tests/python-compounds.test.mjs
node --test tests/python-compound-contract.test.mjs
```

The [machine-readable record](python-compounds-20260920.json) retains the exact
wheel, receipt, source, compiler model and independent consumer identities.
Each source path passes 11,293 installed checks on CPython 3.11.2. Each run
verifies and relocates the release, deletes its producer workspace and
build output, then installs offline into a fresh venv. The consumer PATH excludes
compilers and runtime overrides. Both generated signatures and compiled source
types must match the independent reviewed signature catalog.

Checks cover all primitive payloads in every constructor, asymmetric result
branches, nested options, arrays of options/results/products, mixed record
fields, 24 nested Options, exact 5,121-bit integers, IEEE edge values, Unicode/NUL,
byte copies and independent returned storage. Public annotations resolve for
every export. Invalid payloads, subclasses, coercions, product arities, forged
cycles and malformed private flags reject. Four threads call the same installed
runtime with separate scratch storage.

Python conversion and native input/output copying each have a 16 MiB call
budget. Oversized inputs and results fail, followed by successful calls.
Forty-eight injected result-conversion failures verify output cleanup and
released Python input scratch. The native allocation-fault checks remain in the
C/C++ compound suite. These limits do not bound Lean's working memory or all
Python object overhead.

Local execution uses CPython 3.11 with a tested glibc floor of 2.36; CI builds
the supported 2.38-floor wheels. Tests do not claim support for free-threaded
interpreters, subinterpreters or non-CPython implementations.

This milestone promotes 18 Python profile/path/type/position cells: options,
results and products in inputs, results and fields through both source paths.
Compound callable signatures, lists, aliases with distinct runtime identity,
tagged variants, recursive copied types and resource-containing copies remain
outside this milestone. Other unimplemented host adapters are not promoted.
