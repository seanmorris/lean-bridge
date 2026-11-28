# A WIT guest constructs a record that owns two boxes

An application component can construct `pair`, pass it to compiled Lean, and
keep a box from the result after it drops the record. Workshop defines the
record; the application defines the boxes; Gauge is an independently built
package that uses the same defining interface. Neither package converts an
application object into a numeric public handle.

The [guest](../../tests/fixtures/static-host-workers/peer-object-record.wat.in)
creates two distinct boxes, a byte list and a 131-bit natural number. It
overwrites the input buffers immediately after construction. Compiled Lean
reads two records in one call, swaps the fields, extends the bytes and
increments the number. The guest checks the getters and calls a returned
Lean function after dropping its input record. It drops the original boxes
and the output record, then uses the getter's last owner in Gauge to change
23 to 42. The defining guest’s live counter reaches one: only the box used
to read that counter is left, and the client then drops it.

The [ordinary](wit-host-record-20261126/ordinary.json) and
[reviewed](wit-host-record-20261126/reviewed.json) executions pin the receipts,
archives, application component and defining guest. Both package orders return
42. A second instance of the defining guest cannot supply a compatible
`retain-box`. The reviewed route preserves an author's documentation edit;
swapping two same-type fields is rejected before a release is written.

Run `npm run test:wit-host-records` with the [WIT publisher
toolchain](../publish/wit-wasi.md#when-the-application-owns-the-objects).
Set `LEAN_BRIDGE_WIT_RECORD_HANDOFFS` to an existing directory to retain the
archives. With that variable unset, set `LEAN_BRIDGE_WIT_RECORD_REPLAY` to the
reported directory containing `ordinary/`, `reviewed/` and `peer/` to reinstall
them. The consumer runs with no author tools on its path. This case establishes
object fields, not records containing registered callbacks or closures.
