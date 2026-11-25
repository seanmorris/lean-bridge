# Installed C synchronous Lean iterators

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
promotion or a result for the C++ or Rust APIs.
