# Borrowed C++ member results

The [package test](../../tests/helpers/cpp-host-anchors.mjs) built ordinary
Lean source with a strong-canonical `Box` and weak-canonical `Dial`. It
verified the package-set receipt, removed the producer, relocated the archive
and compiled a C++20 application against its installed pkg-config entry.

- Archive SHA-256: `b682181e5f20b1d64945a178c2535c436c46da6e28cb429e466d2ebbe3aa2f0e`
- Receipt SHA-256: `e60d2b9b660e1483435a06ba805f5b10888ec24fe501ff87dab257ef6c3494b5`

Four independent invocations ran with no producer tools on PATH:

| Case | Observed behavior |
| --- | --- |
| Valid | Two different nominal types could share the same address and control block (the first field), or different addresses and the same control block (the second field). Lean called both. Parameter-anchored returns kept the caller's original object. Leased and transferred member arguments survived in the host when retained. Weak objects expired on release; the strong object expired when the second binding closed. All destructor counts matched. |
| Wrong receiver anchor | A fresh, unrelated result was rejected. Both bindings stopped serving calls and still closed cleanly. |
| Wrong parameter anchor | Returning a field owned by the receiver instead of the declared argument was rejected and retired both bindings. |
| Conflicting control block | Returning a lease with the same address but another control block was a malformed reply, not an application exception. Both bindings retired. |

The valid process also rethrew an application-thrown `std::invalid_argument`
with the original `exception_ptr` and remained usable, round-tripped positive
and negative 321-bit integers, and rejected an over-budget input without
retiring the runtime.

Run `npm run test:cpp-host-anchors` to rebuild. For replay set
`LEAN_BRIDGE_CPP_HOST_ANCHORS_REPLAY` to the handoff directory. Run
`npm run test:cpp-host-registry` for the independent typed-owner registry
checks. This covers synchronous native C++ members, not C++ worker dispatch.

The final wrapper also passed the two-component [regression
test](../../tests/helpers/c-host-components.mjs) in both link orders. The
component SHA-256s were
`4c0f9b6f8d69ea907f6046f76b7f144cdc42e54709509ae7473a26f1dda64c2c`
and `3cf0a7bf939b909302500f9e64d634f28241903b1e5cc78b89000f76de6cdc62`;
both builds produced the same domain,
`b0978a8fe2b9b7663eb3dbc5c7d7cdcfe66b60e389bdba4744225a135af4285d`.
