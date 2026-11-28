# Rust records keep the original application objects

The [Rust application](../../tests/fixtures/rust-host-record/consumer.rs)
passes two `Rc<Meter>`s, bytes and a 131-bit natural to compiled Lean.
Lean calls a method on the first meter, swaps the fields and returns a
record. Rust distinguishes a copied vector from a shared object: changing
the vector returned by a getter does not affect the record, while
`Rc::ptr_eq` identifies the exact meter it passed in.

Three lifetimes are observable without looking inside the runtime:

- A returned Lean function still reads the original meters after the input
  records are dropped.
- The returned record outlives its binding. Dropping it destroys one meter;
  the other survives because Rust kept a getter result.
- A [second installed component](../../tests/fixtures/rust-host-record/Inspector.lean)
  increments that meter and returns the same object. It remains readable
  after both bindings close. Dropping the last handle expires the weak
  pointer. Each component has its own Rust binding type and Lean entry.

An oversized input in the second record fails before the first meter is
read. If the meter's member returns `Err`, the caller gets the original
Rust error allocation back. A
separate output exceeds the copy budget after Lean has produced a byte
field and exported a meter, but before the second 9 MiB buffer can be copied.
The program observes `Fault::Limit`, drops its own meter, checks that its
weak pointer has expired, and calls a previously created function successfully.
This tests rollback of a partial **result**, not a record-valued EIO error.

| Gauge authoring route | Archive receipt | Consumer executions |
| --- | --- | --- |
| Ordinary Lean source | [Package set](rust-host-record-20261126/ordinary.package-set.json) | [Both package load orders](rust-host-record-20261126/ordinary.execution.json) |
| Edited, reviewed interface | [Package set](rust-host-record-20261126/reviewed.package-set.json) | [Both package load orders](rust-host-record-20261126/reviewed.execution.json) |

Run `npm run test:rust-host-records` on a configured Linux x86-64 producer
with Rust 1.90 and the locked dependencies in its offline Cargo cache.
The [installer](../../tests/helpers/rust-host-record-installed.mjs) builds
Gauge with the Rust host import and builds [Inspector](rust-host-record-20261126/peer.package-set.json)
separately. It checks that the crates use the same runtime archive, rejects a
review with reordered fields, and requires Rust to reject a record from the
wrong binding specialization. The final applications run offline with no
compiler, Cargo registry, source projects or package handoffs.
