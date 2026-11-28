# Calling returned Lean functions from an installed Rust crate

The [Cargo client](../../tests/fixtures/rust-host-closures/consumer.rs)
passes two different meters to [Lean](../../tests/fixtures/c-host-closures/Closures.lean):
one to the factory and one to the returned function. `Rc::ptr_eq` confirms
that the result is the original captured meter. A failing member returns its
original `Rc<dyn Error>`, and the next call works.

The client re-enters a second function and closes the first during its own
call. Another call to the closed function fails immediately; the original
call still finishes. A separate case drops the last binding from inside
the call. That call returns the right object, but the function cannot attach
to a replacement binding. Reference counts and application destructor
counters check that dropping a function or closing its binding releases the
right capture, even while another binding remains in use. Cargo also rejects
an attempt to require `Send` for the returned function.

A fresh process panics inside a member. The caller observes `CallbackPanic`,
the sibling binding refuses another call, and both application destructors
run exactly once. A declared host error does not cause that retirement.
The worker-enabled client also awaits a task that returns the same meter,
observes a missing-file IO error in a returned function, then reads two
different contents from that function after writing the file between calls.

| Installed Cargo configuration | Verified package-set receipt (SHA-256) |
| --- | --- |
| Ordinary source | `55abf0c937a2fea9fc90b7aacca4adfff24b0e08b12d2b072af22c4fcb686b7d` |
| Reviewed interface | `a2c00d0a926c28bf906a2cdb9d155aeea2763c74c00adf27c7184105b21d1f0b` |
| Worker and filesystem grant | `466585d86fd538ceac152b3871fe7421a95a3c35d71e78950be3389cc4c6381e` |

Run `npm run test:rust-host-closures` with the native publishing toolchain
and a Cargo cache containing the versions in the runtime lockfile. The
[test](../../tests/helpers/rust-host-closures-installed.mjs) installs the
archived publisher offline, rejects a stale C++ owner in the review, and
rejects the file-reading factory without its filesystem grant. It verifies
both Cargo archives, builds with Cargo/rustc 1.90.0, then removes the
registry, sources, and build tree before running the relocated executable.

As a regression check, `npm run test:rust-host-components` compiled the
current Rust facade and ownership runtime against two previously verified
native libraries without closure factories. The client retained the original
object and error in both component load orders.
