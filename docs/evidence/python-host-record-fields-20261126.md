# Python records holding application-owned objects

The installed `lean_meter` wheel can take and return a `Workshop.Rack`.
Its two meter fields hold ordinary application-created Python objects.
The application never constructs a handle or implements a conversion.
This is a different ownership case from a record containing a Lean-created
`Ticket` or a closure that happens to capture a meter.

The same runs cover a second position: an **immediate export result**.
[`selectPrimary`](../../tests/fixtures/python-host-record/Workshop.lean)
returns a `Box`, not a record, iterator, function or task. The
[client](../../tests/fixtures/python-host-record/consumer.py) constructs a
rack from two different meters and checks `api.select_primary(first) is a`.
All four execution reports below pin that client and their respective wheel
receipts. Together with the [worker cases](python-worker-wheels-20261124.md#which-host-object-positions-do-these-wheels-cover),
these two package families cover all five host-object positions on both
Python authoring routes.

| Interpreter | Ordinary Lean source | Independently reviewed interface |
| --- | --- | --- |
| CPython 3.11 | [Execution](python-host-record-fields-20261126/cp311/ordinary.execution.json) · [wheel receipt](python-host-record-fields-20261126/cp311/ordinary.package-set.json) | [Execution](python-host-record-fields-20261126/cp311/reviewed.execution.json) · [wheel receipt](python-host-record-fields-20261126/cp311/reviewed.package-set.json) |
| CPython 3.12 | [Execution](python-host-record-fields-20261126/cp312/ordinary.execution.json) · [wheel receipt](python-host-record-fields-20261126/cp312/ordinary.package-set.json) | [Execution](python-host-record-fields-20261126/cp312/reviewed.execution.json) · [wheel receipt](python-host-record-fields-20261126/cp312/reviewed.package-set.json) |

The [producer](../../tests/fixtures/python-host-record/Workshop.lean) borrows
a rack, reads an application meter, swaps the fields, and returns a new rack.
The [consumer](../../tests/fixtures/python-host-record/consumer.py) checks
object identity with `is`, mutates a meter, and reads again through Lean.
A bad class or out-of-range offset fails before either meter's read method
runs. If the read itself raises, the caller catches the original exception
object and can make another valid call.

A returned record can hold the same meter twice. Closing another record
does not invalidate it; exiting the host binding does not invalidate its
Python fields. A weak reference shows the result keeps a meter alive after
the application drops its own reference, and releases it when the rack
closes. A closed rack refuses reads and calls; a second close does nothing.

The [harness](../../tests/helpers/python-host-record-installed.mjs) builds
two distinct projects, verifies the package receipts, deletes the producer
sources, and installs both dependency and component wheels offline. It
removes the wheel feed and moves the virtual environment before executing
the consumer with `python -I` and no tools on `PATH`. The reviewed route
uses an interface with independently edited documentation and no export
list. Reversing its field order is rejected without producing a release.

To repeat with a configured Lean toolchain, select each Python interpreter
in turn. The evidence directory is separate for each:

```sh
LEAN_BRIDGE_PYTHON=/path/to/python3.11 LEAN_BRIDGE_PYTHON_HOST_RECORD_EVIDENCE=build/rack-cp311 npm run test:python-host-records
LEAN_BRIDGE_PYTHON=/path/to/python3.12 LEAN_BRIDGE_PYTHON_HOST_RECORD_EVIDENCE=build/rack-cp312 npm run test:python-host-records
```

These local Linux results cover flat, synchronous record arguments and
results with declared Python host objects. They do not cover asynchronous
records, callback slots, other languages, or the final release matrix.
