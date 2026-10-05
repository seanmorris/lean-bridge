# Rust methods, properties and receiver-bound results

VO task: 1219. This milestone projects compiler-checked receiver declarations
into typed Rust members and prepared Cargo packages.

Methods use snake-case names on `Value<T>`. Properties are zero-argument accessors.
Consuming methods require a mutable receiver; other methods borrow it. A result
keeps the selected receiver or remaining parameter as its lifetime anchor.
Closing or consuming the original owner expires its descendants. Explicit
retention creates independent ownership. Empty values keep their whole owners.

The [machine-readable record](owned-rust-receivers-20261001.json) binds the exact
source inventory and the complete gate:

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-rust-receivers
```

The local glibc floor selects this test host. Published package requirements are
unchanged. Acceptance requires ten tests with no skips: two API checks, two
compiled runtime paths, four resource-only capability cases, and two installed
crate paths. Both ordinary source and independently authored reviewed IR compile
fresh Lean code.

Runtime assertions cover all sixteen receiver exports, original and independent
owners, other-argument anchors, empty and recursive values, callbacks, returned
closures, allocation failures and panic cleanup. Invalid nominal receivers,
raw anchors, immutable consuming receivers and cross-thread ownership fail Rust
compilation. Three deliberately broken adapters must compile and fail the
unchanged assertions; the restored implementation must pass again.

Installed tests use an offline-installed CLI, compare two independent builds and
reassembled archives, and reject forged contracts and resealed generated-source
edits. Cargo consumers use an empty Cargo home, vendored dependencies and a
link-only C driver. The consumer and documentation example run after removing
the producer source and CLI. The relocated executable runs after removing the
installed crate, dependencies and handoff too.

This record does not promote support-table cells, demonstrate Docker execution,
or implement callback-result lifetime anchors. Those remain separate audit work.
Earlier receipts remain unchanged; registered source edits preserve their exact
historical inputs and leave unrelated edits visible.
