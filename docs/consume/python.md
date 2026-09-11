# Use a Lean package from Python

Install the Alpha interoperability wheel and import `lean_alpha`. The wheel includes the generated Python API, its native adapter, the Alpha component, and the Lean runtime. Consumers do not compile Lean.

## Use a prepared release

### Requirements and package

Use Python 3.11 or newer on Linux x86-64 with glibc 2.38 or newer, with pip and Python's `venv` module. The [support contract](../consumer-support.v1.json) records the tested profile.

Obtain `lean_bridge_alpha-0.0.0-py3-none-manylinux_2_38_x86_64.whl` from the publisher's release channel. [Use a prepared release](receive-package.md) covers handoff authentication separately.

## Install the wheel

Put the original release wheel in your project directory, then install it in an isolated environment:

```sh
python3 -m venv .venv
./.venv/bin/python -m pip install --no-index --no-deps \
  ./lean_bridge_alpha-0.0.0-py3-none-manylinux_2_38_x86_64.whl
```

pip checks the wheel's platform tag and Python requirement. The installed package loads its bundled native libraries when imported.

## Call Lean

Save this file as `main.py`:

```python file=python/main.py
from lean_alpha import (
    Box, DisposedResourceError, Payload, make_adder, round_trip, with_callback,
)


def require(condition):
    if not condition:
        raise RuntimeError("Unexpected Alpha result")


with Box(42) as box:
    require(box.read() == 42 and box.identity() is box)
box.close()  # Closing an already-closed resource is safe.
try:
    box.read()
except DisposedResourceError:
    pass
else:
    raise RuntimeError("A closed Box must reject reads")

value = round_trip(Payload(True, 41, "Lean λ", b"\x00\xff", (0, 2**32 - 1)))
require(not value.enabled and value.count == 42)
require(value.label == "Lean λ" and value.bytes == b"\x00\xff")
require(value.values == (0, 2**32 - 1))
require(with_callback(40, lambda current: current + 2) == 44)
with make_adder(2) as add_two:
    require(add_two(40) == 42)

print("Box: 42; payload: 42; callback: 44; closure: 42")
```

Run it with the same interpreter used for installation:

```sh
./.venv/bin/python main.py
```

Expected output:

```text
Box: 42; payload: 42; callback: 44; closure: 42
```

## Values and cleanup

### Type conversions

Profiles: Python. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `None` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `int` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `float` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `str` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `bytes` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `tuple[T, ...]` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `T \| None` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | The current nullable annotation collapses nested Option and Option Unit; lossless tagged conversion remains work. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Ok[T] \| Err[E]` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `tuple[T, U, ...]` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated frozen dataclass (Alpha: Payload)` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Resolved target type` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `Generated case classes` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box / generated resource class` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Callable / generated callback` (input) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | `Named finite specializations` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | `async def returning T` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `Transform / generated callable` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | `Iterator[T]` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | `AsyncIterator[T]` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

This table describes the prepared Alpha wheel used above. Names such as `Payload` and `Box` refer to its generated API, not a conversion of every Lean structure into that Python class.

| Lean type | Python type | Conversion rules |
| --- | --- | --- |
| `Bool` | `bool` | Requires `True` or `False`. |
| `UInt32` | `int` | Requires an integer from `0` through `4294967295`; `bool` is rejected even though Python treats it as an integer subclass. |
| `String` | `str` | Encoded as UTF-8 on input and decoded on return. |
| `ByteArray` | `bytes` | `Payload` copies byte input into immutable `bytes`; returned bytes are owned Python data. |
| `Array UInt32` | `tuple[int, ...]` | `Payload` copies the sequence into a tuple and validates each unsigned element. |
| `Payload` | `Payload` | Frozen dataclass with the five fields shown above; no explicit cleanup. |
| `Box` | `Box` | Identity-bearing wrapper. `identity()` returns the same object; use `with` or `close()`. |
| `UInt32 → UInt32` callback | `Callable[[int], int]` | Synchronous Python callable; arguments and results obey the `UInt32` range. |
| Returned Lean closure | `Transform` | Callable object returned by `make_adder`; use `with` or `close()`. |

## Types, errors, and cleanup

`Payload` is a frozen dataclass. It copies bytes and sequence inputs into `bytes` and `tuple`. Alpha uses unsigned 32-bit integers, so pass integers from 0 through 4,294,967,295. Generated validation rejects out-of-range inputs before calling Lean.

Alpha's `round_trip` toggles `enabled`, increments `count`, and preserves the label, bytes, and values. Its callback fixture also adds two to the callback result: the example callback produces 42, and Lean returns 44.

Use `with` for `Box` and the `Transform` returned by `make_adder`. Both release their Lean resources when the block exits, including on exceptions. `close()` is idempotent; a closed `Box` raises `DisposedResourceError` on reuse. Ordinary copied `Payload` values need no cleanup.

## Troubleshooting

- If `venv` is missing, install your distribution's Python venv package before creating the environment.
- If pip rejects the wheel's platform, use a supported Linux environment. Updating pip cannot provide a missing glibc version.
- If `import lean_alpha` fails, run pip and the program through the same `.venv/bin/python`.
- If loading the native library fails, keep the installed package intact and check the reported glibc and architecture requirements. Copying only its Python files omits the native component.

#### Diagnose wheel compatibility

For more detail before retrying installation, request the release's adjacent `python-wheel-preflight.mjs`. This optional diagnostic needs Node.js 22; normal wheel installation and Python calls do not.

```sh
node ./python-wheel-preflight.mjs \
  --wheel ./lean_bridge_alpha-0.0.0-py3-none-manylinux_2_38_x86_64.whl \
  --python ./.venv/bin/python
```

The preflight checks the selected interpreter, glibc, architecture, Python version, and pip's accepted wheel tags. Exit status 2 means the host cannot install this wheel. Do not rename, retag, or unpack the archive to bypass pip's decision.

## Start from a raw Lean package

Follow [the Python build-and-publish guide](../publish/pypi.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Package authors and acceptance

Repository checks live in [Contributing](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/pypi.md).
