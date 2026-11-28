# Rust host objects across two compiled Lean components

An ordinary Rust project supplied its own `Meter` with inherent methods.
The generated `bind_objects!` macro bound those methods in each crate. The
application used `Rc<Meter>`, not a dispatch table or native handles.

The [native build](../../tests/helpers/rust-host-pair.mjs) compiled two
independent Lean projects, verified their captured source, and checked that
only their call and cleanup operations were exported. Both produced the same
native ownership library. The [Cargo test](../../tests/helpers/rust-host-components.mjs)
built a client offline, removed the Cargo sources and build directory,
relocated the binary and its libraries, and checked each resolved library
path before running with no compiler or Lean on PATH.

| Artifact | SHA-256 |
| --- | --- |
| Workshop component | `971ea1efe3f4ef15a82d5277989c1efa0b249cb286ccb27c23c3efdd79732df6` |
| Peer component | `775daa7b1166ec13972f6d6d916a02617c30000a3701c3faca3b2177e5d4a0f4` |
| Shared domain | `6faded31be2d74ea84fe2ac26b5c1752db3d9d5c2969146ee847eb05269f326c` |

In both initialization orders the [client](../../tests/fixtures/rust-host-members/client.rs)
observed the original object after a cross-component mutation and the original
`Rc<dyn Error>` after nested reentry. Mapping the error to `EIO String`,
throwing an object through `EIO`, and returning a Lean `Except` produced three
distinct Rust outcomes. Reentrant close was busy; explicit close was idempotent.
An application panic retired both components without unwinding through Lean,
and destruction counts returned to baseline. A different Cargo runtime instance
was refused before it could use either component's tickets.

The independent [owner test](../../tests/helpers/rust-host-owner.mjs) also
checked receiver/parameter identity for an anchored result, wrong-kind,
stale and foreign tickets, fork and thread isolation, and reentry from `Drop`.
These are direct native/Cargo results, not evidence of a published Cargo
archive or of Rust worker-thread host-member delivery.

Run `npm run test:rust-host-components` and `npm run test:rust-host-owner`.
