# Recursive Python value declarations

The Python graph generator emits frozen, slotted dataclasses for records and
variant constructors. Variant names are type unions; pattern matching and
`isinstance` use named constructors. Recursive references retain nominal types.
Aliases retain their public names and chains without introducing wrapper values.
Some, Ok and Err preserve nested option and result distinctions.

Array and List inputs accept lists or tuples. Their copied result annotations use
tuples. Private runtime TypeAliasType boundaries keep shared structural types
finite; public stubs retain exact recursive types without Any or raw pointers.
Python 3.12 uses the standard-library alias type. Python 3.11 uses the same
typing_extensions dependency as the existing collection packages.

The enabled test executes 54 assertions on CPython 3.11 with typing_extensions
4.6.0 and 4.16.0, and on CPython 3.12 without that dependency. It checks direct
and mutual recursion, nested options/results, aliases, empty and Unit
constructors, a 255-field constructor, frozen fields, pattern matching and
independent deep copies. Runtime annotations handle 700 shared structural
aliases without expanding a tree. Strict mypy 2.3.1 accepts the typed consumer
and rejects ten incorrect uses on each runtime. The typed consumer also runs.

```sh
LEAN_BRIDGE_PYTHON_GRAPH_TEST=1 \
  node --test tests/python-copied-graph-values.test.mjs
```

CI retains `build/recursive/python-values.json`. These tests generate and execute
Python declarations, not compiled Lean calls or installed wheels. The ordinary
Python package path still rejects recursive exports. Checked ctypes layouts,
bounded input/output conversion, lifecycle and failure cleanup are covered by
the subsequent [native conversion milestone](python-recursive-conversions-20260923.md).
Prepared, source-free wheel acceptance remains pending. No installed type cells
are promoted by either milestone.
