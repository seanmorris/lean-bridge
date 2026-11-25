# Installable C host-object archives

An offline-installed candidate CLI produced three `native-c-host-v1` releases on
Linux x86-64 with Lean 4.32.2: an ordinary source package, a second independently
named package, and the first package rebuilt from a reviewed API. Removing the
compiled member dependency from a review was rejected without a release receipt.

| Source route | Archive SHA-256 | Package-set receipt SHA-256 |
| --- | --- | --- |
| Ordinary | `358c806bb061ff18bbe36534ce4aa23c90f64e289874275aa73e4661ef81bb95` | `97bfb9fd9250474389bd933e617a3e743a721b991d3d5ffbaa98b1a557d68428` |
| Peer | `35efd48b34c8f0a3698e93aaa78c476677b83061f7c983fd5674df1e8d550dac` | `a3bab664641a9ab17d11f10b062de255b037faa455ae7b7175e890e51451ebf2` |
| Reviewed | `01b47eb171aa585842b1cee8a4b3c747c9afcded69e55eab36b3f1939e4dc2ff` | `d4e3a30b3311f879cfa21901f49b8e66b6eddeacd44470413636059e5c65f43c` |

The first local CMake launcher failed before configuration because its Python
module was not installed on the launcher's search path. Replaying the same
receipts with the native CMake executable passed in 39 seconds. No Lean build
ran during replay. Each archive's receipt, sidecar, ELF inventory and header
were checked before the downstream builds.

The [downstream application](../../tests/fixtures/c-host-members/consumer.c)
ran eight times: ordinary or reviewed paired with the peer, both link orders,
pkg-config or CMake. Its process had no compiler on PATH. Each run observed a
shared mutable object, an independent owner from the typed error slot, and a
distinct returned `Except` error. A nested call handled a peer's host failure
without leaking its diagnostic to the outer call. A malformed successful member
reply retired both components; the application could still close both bindings
and destroy the payload exactly once.

Run `npm run test:c-host-packages` to rebuild, or set
`LEAN_BRIDGE_C_HOST_REPLAY` to the retained release directory to check the
archives without the producer. This evidence covers synchronous C host
members, not C host-bearing workers or other languages.
