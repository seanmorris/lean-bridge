# One C object, two compiled Lean components

`node --test tests/helpers/c-host-components.mjs` compiles two separate ordinary
Lake packages against the same application-owned meter contract. Set
`LEAN_BRIDGE_LEAN_PREFIX` to the pinned compiler and `LEAN_BRIDGE_C_HOST_SDK`
to a verified native runtime SDK. The test removes its producer trees before
building the consumer, checks the exact public ELF symbols, and links a C11
application against the public headers in both link orders.

On November 25 both applications passed. A mutation in one component was visible
to the other. Both agreed on object identity. A returned `Except.error 17`,
a thrown object-valued EIO, a host failure with code 37, and a mapped Lean error
string arrived in separate channels. Closing the active binding from a member
was rejected without preventing subsequent calls. Stale and wrong-kind inputs
did not invoke the member. Independent owners and the error string remained
usable after binding closure; the original C payload was destroyed exactly once.

| ELF | SHA-256 |
| --- | --- |
| Workshop | `b424c5b6edb2c04ebc768f6c6ac47feed7b5f6e59caadc8dc867ab9118835439` |
| Peer | `68becaca675f1c20dd925b571531bbc38efcfc27c37c9740b9af23d77b6be319` |
| Shared owner domain | `9b7c1fc5a0fc503745c3730ca892c6a9f9ff6314589a7dfdb4c9dff56acea7ac` |

This test exercises the compiled libraries directly. It does not establish
release-archive installation, worker delivery, or C++/Rust/WIT support.
