# Installed structured Python callbacks and closures

VO task 1219. Arrays, Lists, options, results, products, acyclic records,
variants and concrete aliases cross Python callbacks and returned closures
on ordinary-source and independently reviewed package paths.

The 26-export fixture runs from the original wheels on CPython 3.11 and 3.12.
Each of the four installations passes 32,236 public checks, including 367
runtime rejections. Cases cover every variant constructor, empty containers,
nested absent and present options, Unit, domain results, Unicode and NUL,
bytes, exact large integers, independent captures and retained host copies.

Forty paths exercise 5,488 injected failures per installation. Every conversion,
buffer allocation and closure-wrapper checkpoint raises both MemoryError and
a custom BaseException. Scope owners and native closure counts return to their
baselines after each failure; the next valid call succeeds. The probe also
rejects 23 malformed native values and verifies deferred closure disposal.
It changes only in-memory functions, then checks the installed files again.

Strict mypy checks compile and execute the typed caller and the exact
[documentation example](../consume/python.md#structured-callback-values).
Thirteen invalid callers fail at their own source locations. Callback arguments
use owned output types, while callback results and closure arguments accept
input containers. Arrays and Lists arrive as tuples and can be returned as
exact lists or tuples. Callback exceptions retain their identity.

The tests remove author inputs before installation, install offline, relocate
both environments, remove the archive handoff, and execute without Lean or C
compilers. They repeat the public caller after fault injection and verify that
the original installed files have not changed. Six previously admitted
generated packages remain byte-identical to the predecessor.

```sh
LEAN_BRIDGE_PYTHON_STRUCTURED_CALLABLE_TEST=1 \
  node --test tests/python-structured-callables.test.mjs
```

The gate writes `build/structured-callables/python.json`. The separate primitive
regression uses `LEAN_BRIDGE_PYTHON_CALLABLE_TEST=1 node --test
tests/python-callables.test.mjs` and passes 49,937 checks on each source path.

Recursive callable payloads, resource-containing aggregates and the remaining
host projections still need implementation and installed acceptance. This
milestone does not complete task 1219.
