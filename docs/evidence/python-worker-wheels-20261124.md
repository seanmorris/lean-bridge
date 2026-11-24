# Python class identity across Lean tasks and cursors

The public CLI built three Linux x86-64 wheels per tested interpreter: an ordinary
component, the same component rebuilt from its reviewed interface with no export
list, and a separately named peer. `lean-bridge verify` checked each component's
package-set receipt before installation. Both primary routes emitted identical
`binding-ir.json` bytes (SHA-256 `83d67c83bd9c0b392a79b64e1cf0481911cf2a3ad32ea8de1cbc719c228806b7`).

| CPython | Wheel | Bytes | SHA-256 of component wheel |
| --- | --- | ---: | --- |
| 3.11 | Ordinary | 47,824 | `4336f0215a1fb9a95346c50fb1c004bdb2ac43b92e01fd52c7542964b82fa4c6` |
| 3.11 | Reviewed | 47,858 | `91689aa84c117a7c7ec6e0af34838ae30a69f45cedda36d1242639614a53253f` |
| 3.11 | Peer | 38,414 | `e95260e8f96b9c50b4916c14a84417167a0d8c723b34298fd7a1fb8626e0f151` |
| 3.12 | Ordinary | 48,677 | `1d29adb5cb774cc479687518b38871c7ca280d4daaca62c8b3166e36574bd54a` |
| 3.12 | Reviewed | 48,723 | `8aa7c6a53558a602ef624501765bde96b63fe3567bb143291bba5363625c5bd1` |
| 3.12 | Peer | 39,084 | `f2ed818787624b93c0178a6832b01ee5670afa618af4866979eb7a8b9f3ef3c2` |

The shared runtime wheel was 51,310,803 bytes, SHA-256
`29684f9b6e49a8723dd242712b60197ebf9414d1206537d00194679a0af2d0fd`.
Both interpreter versions used that same runtime. On 3.12 the ordinary,
reviewed, and peer package-set receipts had SHA-256 digests
`45e15650260bd994e050d6bb8454643d88d513f5d15816a91d64b4852f175f26`,
`cf00c12b37403b7ee1f3c76f54d0680befa427f5787d2e2c20b103266828721a`,
and `5279bb13ff6c6a8b746c5093ffdba0d989f274f778c1bc5fab46cf31ce91546e`.
Both consumer programs passed on both routes for both interpreters. These are
local release and consumer checks, not hosted CI or registry publications.

After removing the author trees, pip installed each primary wheel locally with
the peer. The tests moved the installation, then ran isolated Python with no
producer tools on PATH.

- [The application](../../tests/fixtures/python-host-tasks/consumer.py) received the original instance from callbacks, task results, cursor items and typed failures. A callback reentered a synchronous Lean method. Lean could recover from a Python application exception; it could not turn a wrong return type or a Python control-flow exception into a successful result. Exiting a binding released an object even when its coroutine had never been awaited.
- [The two-package check](../../tests/fixtures/python-host-tasks/peers.py) passed one Python object between independently compiled components. Closing one binding left its peer usable. Reopening with the same class did not revive the old native ticket. An invalid later argument did not pin a strong-canonical input; a valid call held it until unbind.
- Closing a binding with a callback pending removed its readers before the next event-loop turn. Retiring the shared native runtime rejected pending work and prevented the peer from running another callback. Descriptor counts returned to baseline and native lease counts to zero. A worker finishing after cancellation can release the last internal completion lease after the reader is already gone.

Run `npm run test:python-host-workers` with `LEAN_BRIDGE_PYTHON` set to the
absolute path of the selected CPython interpreter and the pinned Lean toolchain
available to the producer. The compiler controls reject an indirect worker call
to a Python member and a stale reviewed lease. A scalar-only task adjacent to
a synchronous import retains its original binding-independent contract.
