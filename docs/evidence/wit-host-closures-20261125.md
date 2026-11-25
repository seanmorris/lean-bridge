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
