# The last owner of a synchronous C++ or Rust error

The synchronous `Owned.checked` call can fail with a live Lean `Badge`.
An independently built package accepts that same badge in `Owned.later`,
increments it in a Lean task, and returns it. These are two native packages,
not two names for the same wrapper.

The [C++ program](../../tests/fixtures/native-sync-resource/last-owner.cpp)
catches `DeclaredError<Badge>`. The [Rust program](../../tests/fixtures/native-sync-resource/last-owner.rs)
matches `CallError::Declared`. Each closes the original, rejects a stale read,
and passes the error's payload to the peer task. Both read 42 after the worker
returns and close the worker's new lease. Releasing the payload — leaving the
catch in C++, `drop(payload)` in Rust — brings the native identity count back
to zero. Both immediately create and read another badge. This badge has no
file descriptor; this is an identity-count check, not a descriptor test.

| Installed pair | Evidence |
| --- | --- |
| C++20, ordinary-source sync and task packages | [Archive identities and client result](native-error-original-20261126/cpp.json) |
| Rust, reviewed sync and task packages | [Archive identities, provider features and client result](native-error-original-20261126/cargo.json) |
| Rust, ordinary-source sync and task packages | [Fresh Cargo archives and client result](native-error-complement-20261126/cargo.json) |
| C++20, reviewed sync and task packages | [Fresh C++ archives and client result](native-error-complement-20261126/cpp.json) |

The [replay](../../tests/helpers/native-sync-peer.mjs) authenticated the original
[two-package captures](native-sync-cpp-rust-20261122.json) before installing them.
It ran the original application and the new ownership check in separate
processes. The earlier Rust provider supports direct IO and tasks; it predates
the application-host-object feature. Its archive and descriptor are not
interchangeable with a freshly built provider. The pinned consumer dependencies
were resolved offline, and neither installed client ran with build tools on its path.

To repeat the original check, set `LEAN_BRIDGE_NATIVE_ERROR_OWNER_ORIGINAL` to
the original mixed-package capture and run `node --test tests/helpers/native-sync-peer.mjs`
with the C++20 and Rust toolchains and a populated offline Cargo cache.

To build and install the complementary pair, use the same toolchains and
set `LEAN_BRIDGE_NATIVE_SYNC_COMPLEMENT_TEST=1` instead. The ordinary Rust
projects produce the two interfaces reviewed by the C++ build. The two
targets agreed on each public Binding IR. The original consumer also ran
in a separate process for each pair. Each row records its own archives;
the older and newer runtime packages need not be byte-identical.
