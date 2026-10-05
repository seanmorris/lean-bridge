# C methods, properties and receiver-bound results

VO task: 1219. This milestone adds explicit receiver decisions to ordinary Lean
configuration and reviewed APIs, with C as the first installed projection.

`receiver: "method"` or `receiver: "property"` selects the first runtime argument.
Lean checks its nominal resource, owned-record or owned-variant type. A property
has no additional arguments. The semantic API stores its receiver separately;
compiled C adapters preserve the original receiver-first runtime order.

Results can borrow the receiver's original owner or a different parameter's
owner. Releasing or consuming that owner expires every dependent view, including
empty values. Independent retains survive. A consuming receiver cannot anchor
its own result. The public C API takes typed values and explicit owner handles;
no private constructor numbers or JSON payloads cross the boundary.

Native model 10, owned graph 5, C adapter/package version 6 and `ownedValues`
version 5 authenticate the receiver positions and distinct result anchors.
Components without receiver exports retain their previous generated format.
Backends without explicit receiver support reject these contracts.

## Acceptance

Run:

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-receivers
```

The enabled gate requires eight tests with no skips. Both source paths compile
fresh Lean and exercise fifteen receiver exports among twenty-five public
exports. Tests cover receiver and other-parameter anchors, copied properties,
transitive expiration, independent retention, empty and recursive values,
callbacks, consuming receivers, wrong-thread/process use and allocation
failures. ASan/UBSan execution must match the cold-start leak baseline. Seven
compiled mutations must fail unchanged consumer assertions; restored adapters
must pass again. Lean rejects seven invalid receiver contracts, and reviewed
APIs must preserve the method/property kind and lifetime anchor. Separate
resource-only APIs execute methods and properties with independent result
leases and no owned aggregates, anchors, transfers or host callbacks.

An offline-installed CLI builds each source path twice independently. Tests
compare complete original archive bytes, reject forged receiver metadata and
generated sources, remove producer/source/CLI directories, and consume only
the release handoff. pkg-config and relocated CMake builds execute the same
consumer. The [documented C example](../consume/c.md#methods-and-properties) is
compiled and run against each installed package.

The [machine-readable receipt](owned-receivers-20261001.json) binds those runs,
compiler identities, generated adapters, CLI inventories and original archives
to exact source hashes. Historical receipts remain unchanged. CI retains the
enabled log and six execution reports and fails on missing or skipped work.

## Remaining work

Other receiver projections, callback-result anchors and the final cross-language
Docker audit remain open. This receipt does not promote type-support cells or
claim a registry publication.
