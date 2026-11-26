# npm records preserve application object identity in five clients

An application can give Lean a record containing two of its own meters.
Lean reads one meter, swaps them, increments a 131-bit natural number and
appends the reading to the byte field. The returned record holds the
original JavaScript instances. It does **not** share its byte array with
either the input or a previous getter result.

| Authoring route | Packages installed | Clients executed |
| --- | --- | --- |
| Ordinary Lean source | [Gauge receipt](javascript-host-record-20261126/ordinary.package-set.json) | [Five client results](javascript-host-record-20261126/ordinary.execution.json) |
| Edited, reviewed interface | [Gauge receipt](javascript-host-record-20261126/reviewed.package-set.json) | [Five client results](javascript-host-record-20261126/reviewed.execution.json) |

The [JavaScript client](../../tests/fixtures/javascript-host-record/calls.mjs)
runs in Node and Chromium. Its returned Lean function can retrieve either
meter after the input record is disposed. A returned record remains usable
after its creating binding is closed. The application saves one getter
result, disposes that record, and passes the object to an
[independently compiled Inspector package](javascript-host-record-20261126/peer.package-set.json).
Inspector increments the original meter from 23 to 24 and returns that same
instance. Record disposal is observable; this does not measure when a JS
garbage collector reclaims the meter.

The [strict TypeScript client](../../tests/fixtures/javascript-host-record/typed.mts)
is compiled **and executed**. Its own tests check inferred object types,
the original application exception, recovery after a partial output fails,
and the object passed to Inspector. It also requires the compiler to reject
a structural substitute for a generated record, a number in place of a
`bigint`, and assignment to a read-only field. In Chromium the
[page](../../tests/fixtures/javascript-host-record/page.mjs) mounts a React
component and clicks its button. A [dedicated module worker](../../tests/fixtures/javascript-host-record/worker.mjs)
executes the installed packages in its own realm. They do not borrow the
page's result or pass live objects between agents.

Two failure checks have different meanings. An invalid second argument is
rejected before Lean reads the first meter. When a real meter read throws,
the application catches the **same error object**. Independently, a 6 MiB
input leaves room in the 16 MiB call budget for one 6 MiB output field and
a meter, but not the second 6 MiB field. The caller gets a `RangeError`,
not a partly constructed record. A previously returned function still
works. This qualifies a recoverable conversion failure, not an EIO payload
or a runtime trap.

Run `npm run test:javascript-host-records` with the configured Lean/Wasm
producer, the built shared runtime, and Chromium. The [installer](../../tests/helpers/javascript-host-record-installed.mjs)
builds through an offline-installed CLI, rejects a review with reordered
fields, and requires byte-identical shared runtime archives across all
three releases. It removes the source and release directories before
executing the clients. The browser receives only the built site; its two
component binaries, shared runtime and shared object broker must match
the installed Wasm files.
