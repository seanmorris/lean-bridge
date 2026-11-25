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

## Native PHP

PHP 8.2.35 and 8.5.10 NTS CLI each ran the [same PHP client](../../tests/fixtures/native-immediate-cursor/consumer.php)
against an ordinary and a reviewed Composer release. Composer installed
offline; the lock contained only the component and `brick/math`. After
relocation the client had no compiler on its path and used no Amp or Revolt.

| Ordinary source | Reviewed interface (without an export list) |
| --- | --- |
| `f8c52acc12747298e73802d34cbeb73ed4606e50222d2acdd80dbdd7dfd14855` | `32902cc2e7844484552ce07a189ee476c42ad9b21a6b11fc666a2a185b4a5fc4` |

All four combinations distinguished `null` items from exhaustion and
reported the original factory, typed step or IO step failure. A second
iterator could not consume the first one's item. Early `break`, a thrown
application exception, and closing a suspended generator all released the
cursor exactly once (seven opens, fourteen pulls, seven closes). A second
process exited with a live generator; the parent observed the finalizer's
file write. On the 8.2 build with `pcntl`, an inherited generator refused
use and close in a forked child without writing that file. The parent
continued from its previous position. The 8.5 build had no `pcntl`.

Set `LEAN_BRIDGE_IMMEDIATE_TARGET=php-native` and run
`npm run test:native-immediate-cursor`. Use `LEAN_BRIDGE_TEST_PHPS` to
provide a JSON array of absolute PHP CLI paths. Each needs FFI.

## Java and Kotlin

The same Maven JAR supplied two installed APIs: a Java 22 closeable
`Iterator<T>` and a Kotlin 2.2 closeable `Sequence<T>`. The [installation
test](../../tests/helpers/native-immediate-jvm.mjs) installed the original
JAR and POM in a clean offline Maven repository on both source routes,
resolved the classpath, compiled the clients, and relocated the install.
The runtime classpath contained the Kotlin standard library but no
coroutines; the JAR had no task port or reactor.

| Ordinary package-set receipt | Reviewed package-set receipt |
| --- | --- |
| `2a71f36c79cfdc77b1eb5a57438b5b30b8be701e0267b7d0e12796eb56c73988` | `3b145d6d9107677eb1b3cca67ca3f9efaf8bb37b5f21b8c862de334e648e78a4` |

The [Java client](../../tests/fixtures/native-immediate-cursor/InstalledCursor.java)
observed seven opens, thirteen pulls and seven finalizers, including
abandonment, a caller exception, and a pull from a virtual thread.
Repeated `hasNext()` calls did not advance the cursor. The separate
[Kotlin client](../../tests/fixtures/native-immediate-cursor/InstalledCursor.kt)
observed six opens, twelve pulls and six finalizers using `use`, `first` and
`toList`. Both distinguished a unit item from exhaustion and a constructor
exception from a typed or IO step exception. Each language also exited a
separate process with a live cursor; the parent verified the finalizer's file.

[TicketPulls](../../tests/fixtures/native-immediate-cursor/TicketPulls.lean)
yields the borrow's underlying ticket, then throws that ticket on the next
pull. Each client checked that the item and error payload referred to the
same resource and that the payload remained usable after the input, item
and cursor closed. In Java, closing a cursor after `hasNext()` but before
`next()` also returned the native live-identity count to zero without GC.

Run `LEAN_BRIDGE_IMMEDIATE_TARGET=maven npm run test:native-immediate-cursor`
with JDK 22, Kotlin 2.2, Maven and the offline Maven tool cache selected
by `LEAN_BRIDGE_JVM_IO_M2_SEED`.

## Perl

The [CPAN installation test](../../tests/helpers/native-immediate-perl.mjs)
installed prebuilt runtime and component archives offline on threaded Perl
5.38.2 and unthreaded Perl 5.36.3, then relocated them. Both interpreters
ran the [same consumer](../../tests/fixtures/native-immediate-cursor/consumer.pl)
against both source routes without a compiler on their runtime path.

| Ordinary package-set receipt | Reviewed package-set receipt |
| --- | --- |
| `084ed72deb3529e29fbe8a8d2631088346cdaac69d6a9f084a774dd90d46c1ed` | `05e6923605f19a1ba95337eb46a2f7e7f64cae7e72542103d6f69cd062063820` |

`while (my ($item) = $cursor->next)` delivered zero and `undef` as items;
only an empty list ended iteration. Scalar context was rejected before
pulling. Six opens, ten pulls and six closes covered exhaustion, factory
and step errors, lexical scope exit, and an application exception that kept
its original identity. Independent processes tested normal shutdown and a
forked child: the parent's finalizer file stayed untouched at child exit
and the parent pulled again. The threaded interpreter also refused to use
a cloned cursor. Neither `Future` nor `IO::Async::Loop` was loaded.

Both ABIs also borrowed a [Lean ticket](../../tests/fixtures/native-immediate-cursor/TicketPulls.lean)
as a constructor argument, received it as an item and as a typed step
error, and read the error's independent lease after closing the other
wrappers. At the end the runtime reported zero live identities, wrappers,
callbacks and scopes.

Run `LEAN_BRIDGE_IMMEDIATE_TARGET=cpan npm run test:native-immediate-cursor`.
Set `LEAN_BRIDGE_PERLS` to a JSON array of absolute Perl paths. These local
Linux x86-64 builds used the test-only glibc 2.36 floor.

## .NET

The [offline NuGet test](../../tests/helpers/native-immediate-dotnet.mjs)
checked the restored archive against its receipt, built a .NET 8 client,
removed its sources, feed and package cache, and ran the relocated application
without author tools. Both ordinary and reviewed Lean source passed:

| Ordinary package-set receipt | Reviewed package-set receipt |
| --- | --- |
| `9eea730773078fc672d0a7d33edf098d023578eef89ac3e093247391584fddb3` | `3c1b66ae0730aa7cf389a31e10b6edd219adae85f7743a32c5474265a4d23296` |

The [C# client](../../tests/fixtures/native-immediate-cursor/InstalledCursor.cs)
recorded seven opens, eleven pulls and seven closes. It exercised exhaustion,
early exit, the caller's original exception, a wrong-thread pull, and an
abandoned cursor reclaimed on the next owner call. A separate process exited
normally with a live cursor; its parent observed the finalizer's file.
Constructor EIO, typed step failure and IO step failure identified their own
Lean declarations. A yielded ticket and an error carrying that ticket had
independent leases. Closing without reading a prefetched ticket released it;
the runtime ended with zero live identities.

Run `LEAN_BRIDGE_IMMEDIATE_TARGET=nuget npm run test:native-immediate-cursor`
with the .NET 8 SDK selected by `LEAN_BRIDGE_DOTNET`. This checks direct pulls
on Linux x86-64, not asynchronous cancellation or forced process termination.
