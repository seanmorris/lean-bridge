# Returned Lean functions in installed npm packages

A downstream JavaScript class defines `Box`. The compiled Lean factory
`remember : Box → IO (Box → IO Box)` returns a function that captures the
first object. Calling it with a different object returns the captured instance,
not an equal-looking replacement.

## Synchronous releases

The packed author CLI built the releases below. Two independently installed
packages used one runtime in Node, a Chromium page, and a Chromium module
worker. The same consumer ran in both package load orders in Node. The
downstream TypeScript example compiled in strict mode.

| Package set | Verified receipt SHA-256 |
| --- | --- |
| Ordinary | `1c3bea95380908e453ce6a90def338c7e0e8b12442f3d65d1a1b78c9d4d1f62e` |
| Peer, ordinary | `af5df4062ca5d49953b303d9f2a1cf808ea4bf70df6c8a2ef62e75f4b9649ddc` |
| Peer, reviewed | `367981204e9368f339cb5487c40e01f97fc235da93f2c44834d224599bd0238d` |

Shared runtime archive: `8a0bdc14fb424295b5055a48b2a1c200d4846ccc86264b6df9aa528f23fe0943`.
The [consumer](../../tests/helpers/javascript-host-functions.mjs) held 19
functions at once, closed one during argument validation, and closed another
from inside its own call. Both active calls finished; subsequent calls were
rejected. The other binding remained usable. Exceptions propagated unchanged,
including a thrown `undefined`. A separate build that attempted environment
and filesystem access failed before packaging.

A clean export of the staged npm changes, without the pending WIT or Zend
implementation, compiled and exercised 11 source-derived methods
(binding IR SHA-256 `d1f7cfe4a0bc029875f157203a8070ad55769a2fa6dfe9cbc3d032b76c2adbef`).
All seven focused checks passed there, including abandoned-function
cleanup, publication rollback and an isolated import of the worker runtime.

With the single-threaded WASM author inputs and Chromium available, run
`npm run test:javascript-host-closures`. The
[package test](../../tests/helpers/javascript-host-package-flow.mjs) installs the
archives offline. These are local installed results. A module worker making a
synchronous call does not establish Lean Task or cancellation behavior.

## Threaded releases

The [threaded consumer](../../tests/fixtures/javascript-threaded-host-functions/calls.mjs)
passed the returned function directly to a retained callback. With one callback
pending in each of two independently installed packages, closing the peer
canceled its task and revoked its function. Its late result was not inspected.
The sibling callback completed exactly once with its original object.

| Worker package set | Verified receipt SHA-256 |
| --- | --- |
| Ordinary | `37d231f84165103a8e964910bb603145a4b230666f317a5b38fd7d6cf625327b` |
| Reviewed | `c378b887629d9de9871194a5f3594d955f97e1625fd9625e883a3fadfc494aa2` |
| Independent peer | `cf9a10a9808356476d7b3d9b0de150cf0d6b269f60b397892ac60c4d3cbedaed` |

Both release routes passed the same 25 checks in Node, a Node module worker,
a Chromium page, and a bundled Chromium page and module worker. The bundled
deployment reported a closed runtime and zero frames, allocations, pending
operations, native owners and notifications. Strict TypeScript accepted the
callable as a task callback and rejected treating the synchronous factory as a
Promise. A build that could block the JavaScript owner was refused.

To repeat with the verified pthread author SDK, run
`npm run test:javascript-threaded-host-functions`. The
[isolated import regression](../../tests/javascript-task-runtime-imports.test.mjs)
also checks that the published runtime can link its JavaScript and Zend member
dependencies without falling back to the author checkout.
