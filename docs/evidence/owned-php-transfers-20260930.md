# Native PHP input transfers

VO node 1219. The complete acceptance gate passes all eight tests without skips.

Native Composer packages accept explicit consuming arguments from ordinary
configuration and compiler-checked reviewed contracts. Both paths exercise 26
exports, including 20 consuming exports. PHP-Wasm transfers and owner-anchored
borrowed results remain separate work.

Shared aliases and sibling fields close at the native handoff. Independent
`retain()` results survive. Validation and snapshot failures preserve owners;
callback and result-conversion failures after the handoff leave them consumed.
Callback borrows must be retained before consumption. Two consuming arguments
cannot share one result owner.

Private probes exercise host-assembled and recursive values, callback reentry,
single and multiple consuming arguments, Fiber/fork rejection, and PHP/native
allocation failures on both sides of the handoff. Each compiler path completes
2,272 checks with 285 retained injected exceptions and zero final tracked native
allocations or identities.

Each offline, source-free Composer installation completes 277 public checks in
both weak and strict callers. The tests remove producer and handoff directories,
relocate the installation, check deterministic reassembly, reject changed native
assets and altered ownership receipts, and observe automatic shutdown cleanup.

The consuming documentation example builds as a combined C/Composer release and
runs unchanged after source removal. The final acceptance command is:

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-php-transfers
```

The glibc override describes this local Debian host. It does not lower the
published package's declared platform requirement. No registry publication or
unrelated support-table promotion forms part of this milestone.
