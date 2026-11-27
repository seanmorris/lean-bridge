# Who owns a value after an installed call?

The [position table](host-worker-qualification-20261125.md#installed-coverage-after-the-november-26-replays)
answers *where* a value can cross the boundary. VO #1221 also asks when that
value stops being usable. Three separate installed test families exercise that
question on ordinary-source and independently reviewed packages.

| Installed consumer | Transfer of the original owner | Result borrowed from an argument | Receiver methods and properties |
| --- | --- | --- | --- |
| C11 | [Move](owned-transfer-packages-20260929.md) | [Borrow](owned-borrow-runtime-20260930.md) | [Members](owned-receivers-20261001.md) |
| C++20 | [Move](owned-cpp-transfers-20260929.md) | [Borrow](owned-cpp-borrows-20260930.md) | [Members](owned-cpp-receivers-20261001.md) |
| Rust | [Move](owned-rust-transfers-20260929.md) | [Borrow](owned-rust-borrows-20260930.md) | [Members](owned-rust-receivers-20261001.md) |
| CPython | [Move](owned-python-transfers-20260929.md) | [Borrow](owned-python-borrows-20260930.md) | [Members](owned-python-receivers-20261001.md) |
| Ruby | [Move](owned-ruby-transfers-20260929.md) | [Borrow](owned-ruby-borrows-20260930.md) | [Members](owned-ruby-receivers-20261001.md) |
| Perl | [Move](owned-perl-transfers-20260929.md) | [Borrow](owned-perl-borrows-20261001.md) | [Members](owned-perl-receivers-20261001.md) |
| C# | [Move](owned-dotnet-transfers-20260929.md) | [Borrow](owned-dotnet-borrows-20260930.md) | [Members](owned-dotnet-receivers-20261001.md) |
| Java and Kotlin | [Move](owned-jvm-transfers-20260929.md) | [Borrow](owned-jvm-borrows-20260930.md) | [Members](owned-jvm-receivers-20261001.md) |
| JavaScript, React and workers | [Move](owned-javascript-transfers-20260930.md) | [Borrow](owned-javascript-borrows-20261001.md) | [Members](owned-javascript-receivers-20261001.md) |
| Native PHP | [Move](owned-php-transfers-20260930.md) | [Borrow](owned-php-borrows-20261001.md) | [Members](owned-php-receivers-20261001.md) |
| PHP-Wasm | [Move](owned-php-wasm-transfers-20260930.md) | [Borrow](owned-php-wasm-borrows-20261001.md) | [Members](owned-php-wasm-receivers-20261001.md) |
| WIT/WASI | [Move](wit-owned-transfers-20260930.md) | [Borrow](wit-owned-borrows-20261001.md) | [Members](wit-owned-receivers-20261001.md) |

Read across a row. A successful move invalidates the original owner's aliases;
a rejected argument must not consume an otherwise valid owner. A shared owner
and an independent retain have different lifetimes. For a borrowed method
result, the declared anchor matters: closing the receiver invalidates a result
borrowed from **that receiver**, but not a result borrowed from a still-live
argument. The member suites also cover property access after disposal.

The records above contain the original installed runs, not new builds of a
single release. The 36 receipts contain 72 source-route observations. Their
recorded TAP logs match their SHA-256 digests: 365 subtests passed, with no
failures, cancellations, skips or TODOs. The Maven records distinguish Java
from Kotlin. In the npm records JavaScript runs in Node and in browser pages,
React and workers; **the historical TypeScript snippets were type-checked
only**. A [separate executed TypeScript client](typescript-ticket-positions-20261126.md#a-ticket-inside-a-claim)
establishes managed transfer and rollback for a Ticket inside a record; it is
not evidence about the anchor of a named method result.

## Other lifetime requirements

- **Identity across components, mutable objects and wrong-runtime use:**
  the [installed host packages](host-worker-qualification-20261125.md) exercise
  public constructors, methods and accessors on application-owned objects.
  For example, the [WIT guest](wit-host-objects-20261125.md) mutates one of
  two boxes with the same contents, retains its identity through a peer, and
  counts drops in the component that owns it. This is a different contract
  from setters on an immutable Lean value.
- **Reentry, once-only use and disposal during a call:**
  the [one-call tests](native-once-callback-20261126.md) exercise the second
  invocation, not just serialization of a `once` flag. The
  [per-host returned functions](host-worker-qualification-20261125.md#returned-functions-that-capture-application-objects)
  cover who can close a callable while it runs. A store that forbids synchronous
  self-reentry is not evidence that a guest performed that call.
- **Errors, cancellation and pending owners:** use the [failure review](effect-failure-crosswalk-20261126.md)
  for recoverable errors versus terminal faults, and the [async review](async-delivery-crosswalk-20261125.md)
  for disposing pending work, late replies and owner-thread shutdown. A closed
  wrapper, a zero native-owner count and destruction of an entire Wasm heap
  are different observations.
