# Compiled Python Lists

VO1219 adds copied Lean `List` parameters, results and record fields to prepared
Python wheels. Both ordinary-source and independently reviewed builds compile
the same 27-export fixture used by the npm and C/C++ List suites.

Inputs accept exact Python `list` or `tuple` values. Outputs are owned tuples.
Lists preserve element order, duplicates, empty values and nesting with arrays,
acyclic copied records, options, results and binary products. All nineteen
primitive element types use their existing checked Python representations.
`List` and `Array` keep distinct Binding IR constructors and private native types.
Consumers import named functions and generated records; they do not write ctypes
declarations or manage native buffers.

Generated Lean functions construct Lists and perform bounded, tail-recursive
output walks. The adapter does not inspect cons-cell tags or offsets. Python
conversion scopes and native input/output copies each enforce a 16 MiB budget;
type nesting stops at 32. These limits do not bound Lean's working heap.
Native results and Python input scratch are released in `finally`, including
when converting a returned value raises.

## Installed validation

```sh
LEAN_BRIDGE_PYTHON_LIST_TEST=1 node --test tests/python-lists.test.mjs
node --test tests/python-list-contract.test.mjs
```

The [machine-readable record](python-lists-20260920.json) binds the independent
signature catalog, wheels, source identities and consumer hash. Both packages
install offline after removing their producer source and build trees. Consumers
run with Lean, C compilers and runtime overrides absent from PATH.
Each installed wheel passes 78,423 consumer assertions.

The consumer checks nineteen primitive types, 5,121-bit integers, native-width
integer bounds, Unicode/NUL, IEEE special values, mixed List/Array nesting,
List-valued Option/Except/product payloads, copied record fields, empty Lists at
every nesting level and 24-level values. A 30,000-element output checks the
iterative path. Oversized outputs reject, followed by successful calls on the
same runtime. A four-thread check verifies separate call scratch and results.

Strict type checks reject container subclasses, iterators, coercible scalars,
surrogates and cycles. Fault probes inject failures during partial input copying
and after native output allocation. They require native output cleanup and empty
scratch owners before retrying through the public API. Malformed private output
lengths and missing pointers reject before memory reads.

This milestone adds six installed type/position/path cells for Python. List
callback parameters and results remain unsupported. Copied values cannot contain
callbacks or resources. Python 3.11+, GIL-enabled CPython on Linux x86-64 remains
the accepted profile. The local test uses glibc floor 2.36; CI retains 2.38.
