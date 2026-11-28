# One call per Python task registration

The [Budget program](../../tests/fixtures/javascript-once-callback/Budget.lean)
uses two callbacks with identical Lean types. The export contract allows
one call to `f` and repeated calls to `g`. The Python event loop consumes the
allowance before converting a callback argument or dispatching to Python.
An exception from the first call does not restore the allowance.

| Installed CPython | Ordinary source | Reviewed interface |
| --- | --- | --- |
| 3.11 | [Ordinary wheel](python-once-callback-20261126/cpython-311/ordinary.json) | [Reviewed wheel](python-once-callback-20261126/cpython-311/reviewed.json) |
| 3.12 | [Ordinary wheel](python-once-callback-20261126/cpython-312/ordinary.json) | [Reviewed wheel](python-once-callback-20261126/cpython-312/reviewed.json) |

All four installed clients used the same shared-runtime archive. Each
interpreter's ordinary and reviewed component wheels have distinct hashes.

The [downstream client](../../tests/fixtures/python-retained-tasks/budget.py)
observed one call to the restricted parameter, two to the unrestricted one,
and a successful nested task. Lean caught an application failure and retried;
Python received `CallbackAlreadyInvoked` without entering the application
again. Uncaught application exceptions retained their exact identity,
including one with the same message as the policy failure and a previously
caught policy exception. Two slots and two concurrent tasks each got their
own allowance. The already-loaded native broker reported zero live leases
after the event loop closed.

Separately, the [nominal worker contract check](../../tests/helpers/python-budget-contract.mjs)
binds the allowance to the first callback in `Workers.relay`. The generated
adapter compiled against the CPython 3.12, Lean and broker headers on both
real source routes. Its callback still accepts and returns the declared
Python object type, with a leased result. This is a generated-adapter
check; the installed Budget wheels above exercise integer arguments.

Use `npm run test:python-once-callback` with `LEAN_BRIDGE_PYTHON` set to the
interpreter to qualify. Set `LEAN_BRIDGE_PY_BUDGET_KEEP` to an existing
directory to retain fresh wheels, or set `LEAN_BRIDGE_PY_BUDGET_REPLAY`
to the original directory containing `ordinary/` and `reviewed/`. The
installer uses pip offline; the isolated downstream process does not have
Lean on its executable search path.
