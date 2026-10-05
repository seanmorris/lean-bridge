# Callable CI repair, 20 September 2026

The [downstream run for 09b532e](https://github.com/seanmorris/lean-bridge/actions/runs/35468574886)
failed in shared compiler analysis and installed Python callable acceptance.
Its WIT, npm, native PHP, managed-language and Perl XS jobs passed. Core quality
and performance workflows also passed.

## Compiler analysis

`lake-entry-elaboration.schema.json` still required an empty `request.arities`
array after the compiler gained configured returned closures. The older test
also expected both resources and arities to produce unsupported-configuration
diagnostics. Only resources remain unsupported there.

The original failure reproduced with Lean 4.32.2. The schema now accepts closed
declaration/arity pairs with an integer arity from zero through thirty-two.
Compiler analysis passes all sixteen tests, including a successful configured
closure, preserved resource rejection, and malformed arity evidence. Validation
still binds the exact selection to the author's configuration.

## Python fork rejection

The original installed consumer failure reproduced on CPython 3.12.14 with the
ordinary-source wheel: `os.fork()` emitted a deprecation warning and the
installer correctly rejected nonempty stderr. [Python documents this warning
for multithreaded processes](https://docs.python.org/3.12/library/os.html#os.fork).

The fixture deliberately forks to test fail-fast rejection in the child. It
now holds the runtime and closure locks in another thread, captures warnings
only around that fork, and checks the warning count, category and exact message.
The child has a five-second alarm and must reject invocation, disposal and a
normal API call before acquiring either inherited lock. The parent must remain
usable. No runtime warning filter or general stderr exemption was added.

CPython 3.12.14 passes 49,939 checks per source path from offline, source-hidden
wheel installations. The refreshed [Python record](python-callables-20260918.json)
contains the exact consumer, archive, model and receipt hashes. Local builds use
the explicit glibc 2.36 test floor; CI retains its production 2.38 floor.

CPython 3.11.16 also passes both installed source paths, with 49,937 checks each.
That interpreter emits no fork deprecation warning; the fixture asserts that
difference. Both versions preserve the installer's empty-stderr requirement.

The local interpreter came from official Docker image
`python@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e`.
Its `/usr/local` interpreter tree was copied into the ignored
`.toolchains/python312` directory. The temporary container was removed.

## Reproduce

```sh
LEAN_BRIDGE_COMPILER_ANALYSIS_TEST=1 \
  node --test tests/compiler-analysis.test.mjs
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
  LEAN_BRIDGE_PYTHON=/absolute/path/to/python3.12 \
  LEAN_BRIDGE_PYTHON_CALLABLE_TEST=1 \
  node --test tests/python-callables.test.mjs
```

These repairs add no type-coverage cells and do not publish packages.
