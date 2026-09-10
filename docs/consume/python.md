# Use a Lean package from Python

Install the Alpha interoperability wheel and import `lean_alpha`. The wheel includes the generated Python API, its native adapter, the Alpha component, and the Lean runtime. Consumers do not compile Lean.

## Use a prepared release

### Requirements and package

Use Python 3.11 or newer on Linux x86-64 with glibc 2.38 or newer, with pip and Python's `venv` module. The [support contract](../consumer-support.v1.json) records the tested profile.

Obtain `lean_bridge_alpha-0.0.0-py3-none-manylinux_2_38_x86_64.whl` from the publisher's release channel. [Use a prepared release](receive-package.md) covers handoff authentication separately.

### Install the wheel

Put the original release wheel in your project directory, then install it in an isolated environment:

```sh
python3 -m venv .venv
./.venv/bin/python -m pip install --no-index --no-deps \
  ./lean_bridge_alpha-0.0.0-py3-none-manylinux_2_38_x86_64.whl
```

pip checks the wheel's platform tag and Python requirement. The installed package loads its bundled native libraries when imported.

### Call Lean

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

### Type conversions

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

Alpha does not export `Nat`, `Int`, floating-point, optional, or asynchronous operations. Python's ability to represent those values does not add them to this wheel's API. For another release, read its generated `.pyi` declarations.

### Types, errors, and cleanup

`Payload` is a frozen dataclass. It copies bytes and sequence inputs into `bytes` and `tuple`. Alpha uses unsigned 32-bit integers, so pass integers from 0 through 4,294,967,295. Generated validation rejects out-of-range inputs before calling Lean.

Alpha's `round_trip` toggles `enabled`, increments `count`, and preserves the label, bytes, and values. Its callback fixture also adds two to the callback result: the example callback produces 42, and Lean returns 44.

Use `with` for `Box` and the `Transform` returned by `make_adder`. Both release their Lean resources when the block exits, including on exceptions. `close()` is idempotent; a closed `Box` raises `DisposedResourceError` on reuse. Ordinary copied `Payload` values need no cleanup.

### Troubleshooting

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

For Alpha, [build the native bundle and Python projection](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer) to produce the wheel used above. Return to [prepared release installation](#use-a-prepared-release) with that wheel and its preflight script.

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Package authors and acceptance

Contributors can [build the Alpha examples](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer) and run the [installed consumer checks](../contributing/testing.md#consumer-acceptance). See [native consumer evidence](../evidence/native-consumer-acceptance.md).

### Publish this package

See [Publish to PyPI](../publish/pypi.md) for package preparation, distribution, and verification after upload.
