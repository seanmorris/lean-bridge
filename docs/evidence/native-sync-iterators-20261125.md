# Installed native synchronous Lean iterators

## C11

Two C11 applications ran against relocated, compiled Dials packages: one
from an export list and one built with a reviewed interface instead. The
public header exposes a typed handle and immediate `open`, `next` and `close`
calls. It exports no polling, task-result or Lean pointer API.

| Package-set receipt | SHA-256 |
| --- | --- |
| Ordinary source | `4e59386f1c6adc366152a62d441221b4abc2db3dd6d195aa8f2fbbad33bf82b2` |
| Reviewed interface | `b6a9f0f6a75d4e1f089f0d08ae32d00c63805e79275da8085dbe9eed42dbd14a` |

The [client](../../tests/fixtures/native-immediate-cursor/consumer.c)
compiled with `pkg-config` against the unpacked archive, then ran after
relocation with the producer and build directory removed. In both runs:

- A successful open did not pull until the first demand. An invalid
  destination, wrong declaration, wrong domain and a foreign pthread could
  not advance or close that cursor. A copied handle remained stale after close.
- An EIO factory error returned `"factory"` without opening a cursor. A later
  typed step error returned `"step"`. The IO step returned `IO_ERROR` and its
  message. A yielded unit was a successful item, distinct from `END`.
- Early close, normal exhaustion and step failures triggered exactly five
  finalizers for five opens and eleven pulls. Closing the same consumed
  handle again did not run the finalizer twice. The real finalizer wrote
  `closed` into the application's file; the compiled effect audit attributed
  that filesystem permission to close, not to every call.

See the [Lean implementation](../../tests/fixtures/native-immediate-cursor/Dials.lean).
Run `node --test --test-concurrency=1 tests/helpers/native-immediate-cursor.mjs`
with the pinned Lean compiler and native runtime, a C11 compiler and
pkg-config. These are local results for `native-c-io-v1`, not a hosted
promotion.

## Rust

An offline Rust 1.90 application compiled against the component and runtime
crates in each verified package set. Its executable ran after the Cargo build
and source directories were removed. For both routes, Cargo selected the
runtime with no features and no dependencies: no async reactor, polling
crate or executor. Verified package-set receipt SHA-256:

| Ordinary source | Reviewed interface (without an export list) |
| --- | --- |
| `144c92fded70cfb7a2520f98425962cf2aa79ef1f366961e39916dd3be2fdeb2` | `105b1d6ab0a62268ba781dc9dc67ad62a10abb8c627e8182188dae4a8503ff6b` |

The [Rust client](../../tests/fixtures/native-immediate-cursor/consumer.rs)
checks at compile time that `Cursor` is neither `Send` nor `Sync`. Opening on
a worker thread failed without touching the cursor counts. Each demand ran
one immediate Lean pull: `Some(Ok(()))` was an item and `None` was exhaustion.
A typed error from `Dials.checked` was distinct from one returned by the
iterator at `Dials.checkedNext`. An IO step reported its original message.
The cursor stayed exhausted after failure, and dropping it early ran the
file-writing finalizer. Five opens, eleven pulls and five closes were
observed independently on each route.

Set `LEAN_BRIDGE_IMMEDIATE_TARGET=cargo` for the same test command. Use the
pinned Rust compiler and an offline Cargo cache. This verifies the local
`native-rust-io-v1` profile, not a hosted or asynchronous Rust profile.

## C++20

The [installed client](../../tests/fixtures/native-immediate-cursor/consumer.cpp)
ran via both pkg-config and CMake for each relocated release. Its cursor is a
move-only, single-pass `std::ranges::input_range`. A loop can break after the
first item without reading the second. Empty optional means exhaustion; a
yielded unit is still an item. A typed factory error and a typed pull error
name different Lean declarations, and the IO pull error preserves its message.

| Ordinary source | Reviewed interface (without an export list) |
| --- | --- |
| `aeb80f7fd4ea28dd21d1cd0cfb99cb4afaedefca8a567dfd24fdddf05ce861ce` | `e2bf231157987bf0bd62ae0d3b6d05b51f87b7222e5718bae19bad3466f2d502` |

Moving a cursor onto another thread did not let it pull or close there.
The client read the native counters directly to confirm that destruction on
that thread deferred cleanup: one cursor closed at the next owner call and
another at process exit. Each execution finished with seven opens, thirteen
pulls and seven closes. The application also observed the finalizer's file
write. To repeat, use `LEAN_BRIDGE_IMMEDIATE_TARGET=cpp` with the command
above and set `LEAN_BRIDGE_CMAKE` if CMake is not on `PATH`.

## Ruby

MRI 3.3.12 installed both platform gems offline, then ran the
[Ruby client](../../tests/fixtures/native-immediate-cursor/consumer.rb)
after relocation, with no compiler on its path. The gem contained the direct
iterator adapter and no task runtime.

| Ordinary source | Reviewed interface (without an export list) |
| --- | --- |
| `ccf58b7a95e8895119d00b56fa098a738773ebe7d44f5f5609df14d0e7cbf1e7` | `b3adda954e49a8faa6aed54329463160ebd5907c6ba38445d771b303da6d6a98` |

Each gem produced eight opens, fourteen pulls and eight closes. A block
could break or raise its own exception without an extra pull. Reentry,
copying and wrong-thread use were refused; the cursor remained usable by
its owner. A typed factory error, a typed step error and a step's IO error
retained their declarations. A unit item was not mistaken for exhaustion.
A weak reference confirmed an abandoned Ruby cursor was collected; a
subsequent owner call reclaimed the native state. Normal shutdown closed
the remaining live cursor. The test also checked the finalizer's file.

Use `LEAN_BRIDGE_IMMEDIATE_TARGET=rubygems` with the native test command
above. Set `LEAN_BRIDGE_RUBY` to the MRI executable for the platform gem.
