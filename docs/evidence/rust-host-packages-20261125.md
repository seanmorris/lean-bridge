# Packaging Rust host objects for Cargo

The [publisher test](../../tests/helpers/rust-host-publish.mjs) installed the CLI from its npm archive offline. It built three Cargo releases: the ordinary Workshop project, an independently named peer, and Workshop with a reviewed binding IR instead of the ordinary export list. A fourth project had a stale review that omitted a member dependency. Its build failed and produced no receipt.

| Release | Component archive SHA-256 | Package-set receipt SHA-256 |
| --- | --- | --- |
| Workshop, ordinary | `24d16ec79832d0cb033c2378f4904c0ad65a0af607c11559339cd9710b4dc40e` | `22e9fafa47c923f6892c00b5cbfd29b3f034f72743fd092c2cd884ec507a881d` |
| Peer | `ada5c3bc17fcf20cbbac424637a6d447cc4fa0a7a66ec9f521de9da1269a5631` | `de8f716f243ef805b27dd222c08d0382ed985ba2dd9bc1e11ace6513bd3359a2` |
| Workshop, reviewed | `3e897c392afe2a919608fa35d0f6161d6ffd5a87bcf1e2c221ea9b5bb67dcace` | `ca1e3a110cc493b21c72c37084fc64c502b3106d5ce22965c9add550af46ccc2` |

All three receipts select `native-rust-host-v1` and the same 51,318,171-byte `lean-bridge-task-runtime` archive (SHA-256 `1c93129be10447d4711595921c52362165be2a0488e65c0b091b49b1957e0bee`). Each component archive is under 44 KB. These were local Linux x86-64 builds with Rust 1.90 and the test glibc floor of 2.36; the production default remains 2.38. No registry upload was performed.

Two fresh Cargo applications each installed a Workshop crate and the peer from a checksum-bearing offline directory registry, using exact versions and no path dependencies. Cargo resolved a single runtime with only the `host-objects` feature. After compilation, the harness removed the client source, registry, Cargo home and build tree. Neither executable had a startup link to Lean or the host libraries.

The [application](../../tests/fixtures/rust-host-members/archives.rs) passed in ten isolated processes: two initialization orders, wrong receiver anchor, wrong parameter anchor and a Rust panic, for **each** Workshop route. It checked cross-package mutation and pointer identity, weak and strong object lifetimes through binding close, and borrowed children that outlived the binding. It also distinguished the original Rust error, mapped and object-valued Lean errors, plain `Except`, and Lean IO failure. An oversized byte argument failed before dispatch and the next call succeeded; an invalid member reply or panic retired both bindings. These results cover synchronous host objects, not delivery from worker threads.

Run `npm run test:rust-host-packages` for the publisher and downstream checks. The [Cargo harness](../../tests/helpers/rust-host-packages.mjs) can also replay a retained set of archives via `LEAN_BRIDGE_RUST_HOST_REPLAY`. Replay verifies the package-set receipts, archive hashes, inner file inventories, and embedded binding and elaboration records before invoking Cargo.

### Running alongside IO and task packages

A separate [four-crate check](../../tests/helpers/mixed-rust-host-crates.mjs) installed fresh synchronous IO and task archives alongside Workshop and its peer. All four required the same runtime archive by hash and version. Cargo enabled `async`, `default` and `host-objects` on just one provider. The relocated executable passed a Lean-owned resource through a task, used a declared error carrying that resource, ran the host-object client, closed its bindings, and then repeated the IO/task operations. This shows that the profiles coexist; it does **not** pass a Rust-owned object to a worker.

The [acceptance record](rust-host-mixed-20261125.json) pins the receipts, enabled features, consumer fixture and native artifacts. To run the [mixed regression](../../tests/helpers/native-sync-peer.mjs), set `LEAN_BRIDGE_NATIVE_SYNC_MIXED_TEST=1` and point `LEAN_BRIDGE_NATIVE_SYNC_MIXED_HOSTS` at the verified host release directory containing `ordinary/` and `peer/`. Run `node --test tests/helpers/native-sync-peer.mjs`.
