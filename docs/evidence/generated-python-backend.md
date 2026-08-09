# Generated Python Backend Evidence

Status: the Alpha Binding IR generates an ordinary Python 3.11 package with inline types, `.pyi` stubs, and a private typed runtime protocol. A native Python consumer fixture executes the public package. The protocol is not yet connected to the real Lean runtime.

## Generated package

`generatePythonBindingPackage` emits:

- `lean_alpha/__init__.py`, the public package;
- `lean_alpha/__init__.pyi`, the static type contract;
- `lean_alpha/_runtime.py`, the private per-declaration transport protocol;
- `lean_alpha/py.typed`;
- `pyproject.toml` and package documentation; and
- a manifest tied to the canonical Binding IR SHA-256 hash.

The package exports only names recorded in `__all__` and the binding manifest. The audit rejects public dispatch functions, private bridge names, WebAssembly machinery, `Any` in the normal stub surface, and raw identity fields.

## Native projections

Alpha's copied record becomes a frozen, slotted dataclass:

```python
@dataclass(frozen=True, slots=True)
class Payload:
    enabled: bool
    count: int
    label: str
    bytes: bytes
    values: tuple[int, ...]
```

`Payload` copies byte and sequence inputs into `bytes` and `tuple`, then validates every field. Fixed-width integers retain generated range checks. Python's arbitrary-precision `int` preserves Lean `Nat`, `Int`, and 64-bit values without narrowing.

`Box` is a normal class and context manager. Construction acquires an identity-bearing value. `read` is a method. `identity` returns the same Python object after checking the private runtime identity. `close` releases once, `__exit__` closes deterministically, and `__del__` provides fallback cleanup.

Host callbacks use normal Python callables. A returned Lean closure becomes a callable `Transform` object with `close` and context-manager support. Runtime identities and transport functions stay in private fields and `_runtime.py`.

Declared Binding IR errors become named Python exceptions. Generated wrappers validate arguments before transport and validate ordinary results on return.

## Protocol coverage

Additional generated fixtures establish native syntax for:

- property getters and setters through `@property`;
- Promise delivery through `async def` and `await`;
- iterator delivery through `Iterator` and `iter`;
- async iterator delivery through `AsyncIterator`; and
- finite generics through one runtime-dispatched function with precise overload stubs.

Python runtime categories must distinguish every finite specialization. A package with two integer specializations fails generation because Python cannot select one branch without a public type token or ambiguous value rules.

## Executed checks

`tests/python-generator.test.mjs` writes the generated package into a fresh directory. Python then:

- installs one typed runtime and confirms exactly-once initialization;
- constructs, reads, compares, closes, and rejects reuse of a `Box`;
- round-trips a rich `Payload`;
- passes a lambda through Lean's callback shape;
- receives and calls an owned callable inside a context manager;
- confirms deterministic resource and callable release;
- rejects an out-of-range `UInt32` before runtime entry; and
- compiles every generated Python module.

The four Python generator tests run as part of the 177-test Node suite.

## Current boundary

The native Python fixture proves package shape, type preservation, validation, identity behavior, lifecycle conventions, callback syntax, stub generation, and runtime initialization policy. It does not prove the private Python protocol against the real Lean implementation. Cross-language conformance must connect Python, JavaScript, C, and Rust to the same component and compare values, errors, identities, callback traces, initialization, and cleanup.
