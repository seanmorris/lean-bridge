# Installed Python tagged variants

VO1219 adds named constructor values to prepared Python wheels on ordinary-source
and independently reviewed IR paths. Each concrete, non-recursive Lean inductive
exports a union of frozen, slotted dataclasses. Consumers construct named cases
and inspect them with pattern matching or `isinstance`.

The [machine record](python-variants-20260921.json) binds independent contracts,
test sources, original wheels, installed files and failure probes.

## Public representation

`SignalData(count, label)` belongs to the `Signal` union. Its `kind` class attribute
is the Lean constructor name, `"data"`. Conversion chooses the active case by its
exact generated Python class. Numeric tags, dicts and subclasses are rejected.
Empty constructors and `Unit` fields remain distinct. Variant fields use
snake_case; reserved names gain a trailing underscore. Naming collisions fail
before compilation, including collisions with records, aliases and helpers.

Private ctypes unions describe the generated C ABI. They never read Lean object
offsets or runtime constructor tags. Typed Lean helpers create and read the
actual Lean values. Private layout names escape Python keywords independently
of the C layout. Only the active payload is converted.

Payloads can contain all nineteen primitives, copied records, arrays, Lists,
options, results, products and other admitted variants. Inputs accept the existing
copied representations; results contain independently owned tuples and values.
The 32-level type bound and separate Python/native 16 MiB conversion budgets
remain in force. They do not bound the Lean algorithm's working memory.

## Installed execution

The fixture has fourteen exports, seven variants with eighteen constructors and
a record containing variants. Both empty and populated buffer constructors cross
the boundary. Every public execution passes 26,434 assertions over 4,383 API
calls, including sixty-four rejected inputs with valid recovery. Each source
path executes once after offline installation and twice after relocation and
removal of the archive handoff. The producer is removed before installation.
No Lean compiler, C compiler or runtime-path override is available to consumers.

Checks cover every constructor, all nineteen primitive payloads, 5,121-bit
integers, fixed and platform-width bounds, IEEE special values, Unicode and NUL,
binary data, arrays of Lists of variants, nested records/options/results/products,
independent copies, frozen fields and pattern matching. Lean independently checks
the scalar payload, with eighteen changed-field negatives. Four Python threads
also make 256 independent calls per execution.

All four loaded native libraries match the installed receipt. Package files stay
unchanged. The installed type stubs pass mypy 1.17.1 in strict mode, including an
exhaustive pattern match. Eight invalid calls or mutations fail for their actual
types, without missing-import or untyped-import errors. Those checks repeat
after relocation; the valid typed program also executes.

An independent rebuild reproduced both original wheels byte for byte. Every
installed package file also matched its recorded identity.

## Failure cleanup

A separate private Python probe injects eighteen temporary-buffer allocation
failures and fifty-eight result-conversion failures across scalar and nested
payloads. Its 754 assertions verify ninety-six native output clear calls, closed
scratch scopes and no surviving tracked temporary buffers after collection.
Seven invalid native constructor tags reject before reading poisoned payloads;
the seven first constructors ignore inactive bytes. These probes repeat after
relocation. The public consumer never imports ctypes or the private adapter.

Each build also runs the shared native probe against the real Lean component:
1,182 assertions, 242 bridge-allocation failures, seventy invalid inputs and one
synthetic invalid returned tag. ASan and UBSan report no errors. The complete
LSan report matches the same executable's startup-only baseline of 128 bytes in
twelve GMP allocations. This establishes no additional reported conversion
leaks, not an empty runtime exit report.

## Reproduce

Use the [Python author toolchain](../publish/pypi.md#build-an-ordinary-lean-project),
a native compiler with ASan/UBSan, and the pinned mypy environment used in CI:

```sh
python3 -m venv build/python-alias-typecheck
build/python-alias-typecheck/bin/python -m pip install --no-cache-dir \
  mypy==1.17.1 typing_extensions==4.16.0 mypy_extensions==1.1.0 pathspec==1.1.1
LEAN_BRIDGE_PYTHON_VARIANT_TEST=1 node --test tests/python-variants.test.mjs
node --test tests/python-variant-contract.test.mjs tests/python-variant-evidence.test.mjs
```

The local host uses glibc 2.36, with the existing test-only
`LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36` override. The production and CI floor
remains 2.38. CI requires and retains `build/variants/python.json`. Fixtures
remove their temporary author and consumer directories. No package was published.

## Scope

This record advances Python copied variant parameters, results and fields on
both source paths. Other host projections have separate acceptance records.
Nine consumer profiles still need variant acceptance. Bounded recursive copied
values, compound callback/closure payloads and explicitly owned identity
aggregates remain open.
