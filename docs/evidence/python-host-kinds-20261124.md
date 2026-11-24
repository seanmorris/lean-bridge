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

## Returned objects and typed exception payloads

The installed wheel pairs built from `0ffe23b` preserved the original Python
object in both arms of a returned `Except`, a direct `EIO` error, and both
object arms of a nested `EIO` error. The ordinary component and reviewed peer
ran in both binding orders. The client cleared exception tracebacks before
leaving both bindings: only the saved results and payloads kept the objects
alive. Discarding those values made both weak references go dead. Trying to
return a stale Lean-held reference failed; a subsequent valid call succeeded.
The installed type stubs described the same nested results and error payloads.

| CPython / component | Wheel bytes | Wheel SHA-256 | Verified package-set receipt SHA-256 |
| --- | ---: | --- | --- |
| 3.11 ordinary | 98,929 | `13bf117d91f45683a1b706a804fb4069e1d88a0e852c17816d4add2d4fcf3971` | `71e1d37d85502a6879faed81b9d15960c80937f5d196908d828504d63f413143` |
| 3.11 reviewed peer | 99,141 | `9e6a069a9e339f103bcf058b3a4440f96ae47a38d07dd31b5fcaab5857b352d4` | `e65ddce89fe2802a954bcc081ac7dec906b1a809216dc8571fd4eca3bfc80d85` |
| 3.12 ordinary | 101,977 | `c284c1eed4e398604d63ffd3a494ad3aafdd65dae8f0b7ec172186c4a18f11d1` | `32571d05a3968dace829e63fc3bfc2f61d59c8dbe897459307635af3747eaa5e` |
| 3.12 reviewed peer | 102,195 | `198d3b8be912d44866408687bc14f904654bf693d2fa18fa648011308d05098a` | `ae580c70985c82a6babb1f63a8292da46c6c2b27f1cc74968500497d3f291d65` |

Both pairs used the same 51,310,803-byte runtime wheel listed above. A review
that changed the declared error payload from a lease to a copy failed before
producing a receipt. Separately, the fresh-source compiler test rejected an
omitted lease, and the generator refused asynchronous host-object payloads.
These checks do not establish that Python objects can cross Lean worker threads.
