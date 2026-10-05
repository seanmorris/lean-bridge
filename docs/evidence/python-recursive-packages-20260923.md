# Prepared recursive Python wheels

Ordinary Lean projects and independently reviewed contracts produce Python
wheels with named frozen dataclasses, constructor unions, transparent aliases
and typed functions over finite recursive values. Arrays and Lists accept exact
lists or tuples and return owned tuples. `Some`, `Ok` and `Err` preserve nested
option and result distinctions. Consumers install the wheel with pip; it loads
its bundled Lean libraries and compatible shared runtime automatically.

The wheel reuses the [checked declarations](python-recursive-values-20260923.md)
and [native conversions](python-recursive-conversions-20260923.md). Calls validate
inputs before native allocation or runtime initialization. Arguments and output
share depth 128, 262,144 visited nodes and a 16 MiB native-copy budget, plus a
separate 16 MiB accounted Python conversion-storage budget. These limits do not
bound Lean working memory or every Python allocator overhead. Cycles and exact
type, scalar, constructor and Unicode errors reject. `finally` blocks release
native results and temporary owners, including on interrupted conversions.

Malformed output retires the runtime. Ordinary validation, limit and recoverable
allocation failures preserve usability. Previously returned Python values own
their storage and remain usable after retirement. Separate private loader imports
prevent public types named `next`, `scope` or `value` from shadowing implementation
names. Compatible recursive and acyclic wheels share their native runtime.

The assembler verifies graph layout metadata and regenerates the private native
headers and C adapter for comparison before packaging. Python-only builds add
no public GMP or Boost dependency. Stubs preserve precise recursive types;
finite runtime aliases use `typing_extensions` on Python 3.11 when required,
resolved automatically by pip. Python 3.12 uses the standard library.

## Installed checks

The [recorded executions](python-recursive-packages-20260923.json) use eighteen
exports on both source paths. Each runs on CPython 3.11 with the minimum and
current accepted typing backport, and CPython 3.12 without that dependency.
Original archives install offline before relocation. The harness removes the
author tree and archive handoff before calls, then repeats public calls without
build metadata. Package inventories remain unchanged. An independent build
reproduces the archives and installed package files.

Each installation executes 308 public checks, including 76 rejected inputs and
256 concurrent calls. Cases cover all nineteen primitives, a Lean predicate
that independently inspects scalar fields, 1,001-bit integers, IEEE edge cases,
Unicode and NUL, direct and mutual recursion, aliases, options/results/products,
empty and Unit constructors, a 255-field constructor and an uninhabited type.
Strict typing accepts the valid caller and rejects twelve invalid expressions.
The exact [consumer documentation example](../consume/python.md#recursive-values)
runs against the installed wheel.

Fault probes exercise 170 Python allocation/interruption checkpoints, with
2,214 checks and 156 owned outputs cleared exactly once. Three-package tests
cover one shared runtime, malformed-output and publication-time retirement,
cross-package rejection afterward, and retained independent values. A deliberate
fork while another thread holds the runtime lock must reject inherited calls
and imports without deadlock. The probe checks CPython 3.12's expected warning
explicitly. Forked reuse remains unsupported; use a fresh interpreter.

```sh
source scripts/env.sh
LEAN_BRIDGE_PYTHON_GRAPH_PACKAGE_TEST=1 \
  node --test tests/python-graph-package.test.mjs
```

CI requires the enabled suite and `build/recursive/python-packages.json`.
[Fresh shared-build regressions](python-recursive-regressions-20260923.json)
check C/C++, Java/Kotlin, recursive Cargo and existing Python collection and
callable packages without rewriting their earlier receipts.

Eight other profiles still need recursive installed acceptance. Structured
callback/closure payloads and aggregates with explicit resource ownership
remain open. These checks do not publish packages to a registry.
