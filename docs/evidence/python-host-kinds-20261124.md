# Rejected Python calls do not pin their arguments

Before this fix, a native reproduction left one strong-canonical Python object
registered when a later argument failed validation. The CPython provider now
validates the arguments in declaration order and registers new host objects
only when the complete argument list is ready to enter Lean. Independently
built components still share the existing Python capsule and registry layout.

The [package test](../../tests/helpers/host-object-installed.mjs) installs the
author CLI offline. It builds Workshop from ordinary source, then independently
builds its peer with a reviewed public interface. It verifies both receipts,
removes the producer, pip-installs both packages and one shared runtime, removes
the wheelhouse, and moves the installation. The [consumer](../../tests/fixtures/host-object/strong.py)
runs without a compiler or package manager on its path.

On **CPython 3.11.16 and 3.12.14**, both binding orders passed:

- Each of 32 fresh strong arguments was rejected twice, once for a wrong
  second object and once for an invalid third scalar. No host method was
  called; all the weak references to those strong arguments went dead.
- A successful member return stayed alive across the inner unbind. A later
  malformed call did not remove that pin. A fresh object admitted by a call
  that raised `KeyError` was also retained, and Python got the original exception.
  Both objects became collectible after the last matching binding exited.
- Unhashable, value-equal instances stayed distinct, a weak-only argument
  was collectible immediately, and a wrong-kind member return failed without
  poisoning the next call. A Lean reference saved across unbind was stale.
- The same installed wheels refused an unverified preloaded runtime and a
  modified component binary in fresh Python processes.

| Wheel | Bytes | SHA-256 |
| --- | ---: | --- |
| Shared Linux x86-64 runtime (both interpreters) | 51,310,803 | `29684f9b6e49a8723dd242712b60197ebf9414d1206537d00194679a0af2d0fd` |
| Ordinary Workshop, CPython 3.11 | 93,674 | `3dc2bfaa0891aa1c9e2dbeafe252b603cf9c4cec4542b9b8d9aa3047d5d2d9d5` |
| Reviewed peer, CPython 3.11 | 93,878 | `a778afc73fc4253abbfaef645c3e3c21749655e5c61ba92d14e2123be8382738` |
| Ordinary Workshop, CPython 3.12 | 97,008 | `3e3e46924e533e51e5f6d4eeeda43cd56b1f7dd7568d868921a39e1cb6547e01` |
| Reviewed peer, CPython 3.12 | 97,215 | `962396e66cfbe796c205b095b8e5640691fdab8724d25ddc19c3e9c9da094f08` |

Set `LEAN_BRIDGE_HOST_PYTHON` to the interpreter and
`LEAN_BRIDGE_LEAN_PREFIX` to its [pinned producer toolchain](../publish/pypi.md#call-python-objects-from-lean).
Run `npm run test:python-host-kinds` once per interpreter. This check covers
the synchronous CPython host provider, not dispatch of Python methods from
Lean worker threads.
