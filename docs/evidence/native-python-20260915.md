# Ordinary-source Python copied values

VO1216 adds ordinary Python/PyPI packages from elaborated Lean projects. This milestone is based on `4af02158a4b6e3a7aa2ff20b363ad4cad3acb32f`; the type inventory binds the implementation and acceptance to source hashes.

## Acceptance

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_PYTHON_TEST=1 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
node --test --test-reporter=spec tests/native-python.test.mjs
```

All four top-level checks pass. The local profile uses CPython 3.11.2, pip 23.0.1, GCC 12 and glibc 2.36 on Linux x86-64. Python's venv support is required by the installation tests. Lean 4.32.2 is pinned to commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. The production wheel floor remains glibc 2.38; local acceptance uses the explicitly recorded 2.36 test override.

Iris and Lotus each expose 42 functions and build from two relocated source trees. Each pair produces byte-identical Python and C archives. The suite hides both source directories, installs the original wheel into a fresh venv with offline pip, then runs consumers with Lean and C compiler paths unavailable. Isolated interpreter mode ignores ambient Python configuration. A ZIP-level check independently verifies every wheel RECORD hash, length and member and rejects duplicate entries or bundled bytecode.

Installed calls cover all sixteen primitive parameters, results, array elements and record fields. Cases include nested arrays, acyclic records, empty records and their arrays, scalar-represented records, multiple arguments and nullary functions. Lotus reverses the leaf record's field order and uses UInt64 where Iris's single-field record uses UInt32.

Values include unsigned maxima, signed minima, integers above 4096 bits, zero, Unicode with embedded NUL, arbitrary bytes, binary32 rounding, NaN classification, infinities and signed zero. Inputs reject Boolean/numeric coercion, wrong widths, negative Nat, wrong record or array elements, malformed Unicode and excessive conversion sizes. Frozen record outputs and nested tuple results remain independent after an input list is mutated. Public runtime type hints resolve successfully, including empty records.

Test-only hooks fail the third scratch allocation and verify that prior ctypes buffers are released. Injected result-conversion failure still clears the native result. A two-million-character input to `grow` fits the native budget but its returned copies exceed Python's conversion budget; the native array is cleared. Larger native calls fail separately, and subsequent valid calls still work. Four threads execute 200 record calls. Three fresh processes import two wheels concurrently and observe one runtime initialization, two component initializations and two attached components.

Modified native library bytes fail import verification. Modified compiled adapter artifacts fail wheel assembly. Tests reject a conflicting runtime identity, an earlier failed loader state and calls after fork. Uninstalling Iris leaves Lotus usable in a fresh interpreter. Missing Python during package assembly leaves no partial release directory. The documentation's `ordinary.py` executes against the installed Iris wheel.

The combined Shop/Telemetry suite passes all seven checks. Shop builds nine targets: npm, CPAN, C, C++, NuGet, Maven, RubyGems, WIT/WASI and PyPI. The targets share one native and one Wasm compilation, and every installed consumer returns the expected value. This local test replaces only Nix transport and uses real compilers; it does not establish actual Nix execution acceptance. The C/C++ regression suite also passes all seven checks.

| Artifact | SHA-256 |
| --- | --- |
| `iris_api-2.0.0rc1-py3-none-manylinux_2_36_x86_64.whl` | `a120d42187d83ec928538357004ac0439b4379c475c864b2ca91b1755a74d346` |
| `lotus_api-2.0.0rc1-py3-none-manylinux_2_36_x86_64.whl` | `263183bf07baa66810e359ff81c2cc3060a87c4dc97bed84b38854ed1a160ba8` |

## Contract and limits

Public Python APIs contain named functions, frozen dataclasses, type stubs and a `py.typed` marker. Native declarations stay in a private module. The generator uses [ctypes signatures and structures](https://docs.python.org/3/library/ctypes.html) for the shared C ABI, not Lean object offsets. Native results are copied into Python values and cleared in `finally`.

Unit is `None` in every position. Fixed-width integers require exact Python `int` values in range; `bool` is not accepted as an integer. Nat and Int preserve arbitrary-precision magnitudes and sign. Float32 requires `float` and rounds to binary32. Text is strict UTF-8, preserving NUL. ByteArray uses immutable `bytes`. Arrays accept exact lists or tuples and return tuples. Record results are independent copied values.

Types must be pure, acyclic and at most 32 levels deep. Python conversion and native input/output copying each have a 16 MiB accounting budget. Python counts at least eight bytes per array element and accounts for text conversion. These budgets do not bound all Python object overhead or Lean working memory. Do not mutate an input during conversion. Fault injection tests adapter cleanup, not recovery from every process-wide allocation failure.

The synchronized loader verifies bundled library hashes and shares compatible libraries through an in-memory module. No runtime file is jointly owned by installed distributions. Libraries remain loaded for the process lifetime. Free-threaded interpreters and post-fork calls are rejected. Subinterpreters and non-CPython implementations have not been accepted.

Wheel assembly verifies compiler receipts and inventories before copying compiled artifacts. It writes deterministic ZIP metadata and a hashed RECORD according to the [wheel format](https://packaging.python.org/en/latest/specifications/binary-distribution-format/). Python syntax checking is not a Lean or native compilation. Consumers need no extension build, setuptools, Node or Lean.

The inventory advances exactly 54 ordinary-source Python cells: parameters, results and fields for sixteen primitives, arrays and copied records. Resources, callbacks, Option, variants, effects and reviewed-IR observations are not promoted. Generic package-set verification remains VO1240 work. This acceptance performs no registry upload or deployment.
