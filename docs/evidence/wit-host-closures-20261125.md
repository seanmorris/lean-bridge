# WIT functions that capture guest-owned objects

The guest calls an ordinary Lean factory through its installed package's WIT
interface. It receives an owned `remember-function`, invokes it with a borrow
of another box, and checks identity using the original defining guest's
`same-box` operation. A second factory returns a function over copied scalars:
after the caller drops its original box, the function can still read it.

## Installed synchronous packages

| Source route | Archive bytes | Archive SHA-256 |
| --- | ---: | --- |
| Ordinary | 61,040,051 | `5fc1956343e10da11cbbc986fed5fe1967f8865e52ac7d7ea93b2c6d2f47c445` |
| Reviewed | 61,043,086 | `f2c3587f33cad9e7ace16646b2b8f0e74909cec57fa18667205e0ef40b1ac64a` |

The [package test](../../tests/helpers/wit-installed-object-packages.mjs)
verified the receipts and extracted both archives into relocated installations.
It built the [independent guest](../../tests/fixtures/static-host-workers/installed-functions.wat.in)
against each published WIT interface, removed the producer and handoff, and
ran the application without Lean or wasm-tools on its PATH.

Factory and invocation failures returned owned errors from the guest; the
guest dropped each error. Explicit close was idempotent. A closed function
remained closed after the factory issued a new function, and dropping its old
handle did not revoke the new one. A different function was released solely
through the canonical resource destructor.

## Installed worker packages

| Source route | Archive bytes | Archive SHA-256 |
| --- | ---: | --- |
| Ordinary | 61,147,512 | `b607dd389d16e5d827211c2df0e05c1740a3d56d23db069538cc843dd22cfed6` |
| Reviewed | 61,151,660 | `3705a4d8f1d77fb899cc4aaccd98f4a54414301b18958624b2df0db6fbac1b10` |

The [mixed worker client](../../tests/helpers/wit-installed-mixed-packages.mjs)
installed each `native-wit-object-task-v1` archive, checked its files against
the package manifest, and ran with the source and handoff removed. Inside a
retained callback, the guest asked Lean for a function, invoked it, checked
the returned box against the original, and dropped both owned resources. Its
subsequent reentrant update completed the future with value 73. Both installs
also passed the synchronous function checks, early stream exit, malformed
argument, callback trap, and refusal of private scheduler imports.

## Two worker packages with pending callbacks

The [two-package client](../../tests/helpers/wit-installed-async-peers.mjs)
installed Workshop and an independently built Gauge. Each guest registration
owned a function returned by **its own** Lean package. With both future reads
pending, the application canceled one. The canceled registration never
invoked its function. The survivor invoked its function with a distinct box
containing the same value and received the original object. Each callback
owner released the function at its last canonical drop; each recorded zero
live registrations and as many drops as acquisitions.

All 80 cases passed: 64 with distinct source boxes, varying creation and
read order, and 16 with a shared source box. Both cancellation directions,
all four ordinary/reviewed release pairs, and both load orders ran. The
Workshop archive hashes match the worker table above. Gauge's archives were:

| Source route | Archive bytes | Archive SHA-256 |
| --- | ---: | --- |
| Ordinary | 61,067,880 | `069c4e9fc13184749409773ab87d8304795685a500a423b8867f1c6e59f89863` |
| Reviewed | 61,070,074 | `6a110d7d1c5eb6f56376313634de5c63d3b5a46535465dd7372643787e256591` |

Run `npm run test:wit-registration-functions` with the pinned WIT author tools.
The run used locally verified handoffs, not hosted CI.

## Two installed synchronous packages

The [peer test](../../tests/helpers/wit-installed-peers.mjs) installed Workshop
and Gauge separately. Each package captured a different box containing 42.
The [application](../../tests/fixtures/static-host-workers/peer-functions.wat.in)
passed each function the other box and checked the result with the defining
guest's `same-box`. Closing and dropping Workshop's function left Gauge's
function callable. After dropping the returned boxes and both functions, the
defining guest counted just one live resource: its own observer.

All four ordinary/reviewed pairs passed in both load orders (eight pairs of
application runs). Each returned 42 from the function probe and 73 from the
separate mutation/error probe. An application that equated the two packages'
function resource types was rejected before its entry ran.

| Installed archive | Bytes | SHA-256 |
| --- | ---: | --- |
| Workshop ordinary | 60,985,592 | `88ce361e4067611779cadcdfa7427e98a398920098e41d1b798fabbe89f43738` |
| Gauge ordinary | 60,985,658 | `a22f129f57d6e84928d3385b9687fb81bf6fb1a7423d9cab41a6f9a722783c96` |
| Workshop reviewed | 60,987,398 | `269418600b44e1ceaed42c4a5a6464b922cdc335cb71d88670197501a8b8a2ba` |
| Gauge reviewed | 60,987,517 | `1e200245671757226c71612f0b9df6c82f00758d374e2cc8b9380e16063aee06` |
| Gauge with an incompatible contract (refused) | 60,985,657 | `d0d1ca22cde90319c90e71bb6d2e6901d76749c9b9914d8fab281274c14485f8` |

The synchronous [composition graph](../../src/backends/wit/application-peer-graph.h)
instantiates the object provider before the Lean package facades, with no
imports. A valid Wasm provider that required Workshop's function-close method
was therefore rejected at composition. A box method in this graph cannot
close the function whose body is currently calling it. This tests that
boundary; it is not an observed close during an active invocation.

The [installed Meter task packages](wit-task-retained-callbacks-20261123.md#reproduce-the-installed-callback-api)
have a different owner: the Wasmtime embedding application registers the
callback and can revoke it from inside its body. The [C client's chain](../../tests/fixtures/wit-task-package/retained-consumer.c)
gave Lean the same registration twice. The first invocation revoked itself
and returned; the next invocation failed with `retained callback is closed`
without entering the callback again. Its context destructor ran once and
never on the active callback stack. With two distinct, live registrations
the same chain returned 112. Both Meter author routes ran this test;
neither changes what a synchronous guest object provider can import.

Run `node --test --test-concurrency=1 tests/helpers/wit-installed-peers.mjs`
with the pinned WIT author tools. To rerun a consumer against the same archive
bytes, set `LEAN_BRIDGE_WIT_SYNC_PEER_HANDOFFS` to an empty directory on the
first run, then set `LEAN_BRIDGE_WIT_SYNC_PEER_REPLAY` to the printed child
directory. Both paths verify the receipts before extracting the active pair.
