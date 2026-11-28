# Binary values in installed Wasmtime task packages

Run `npm run test:wit-pollable-bytes` with the [Wasmtime 42 publisher toolchain](../publish/wit-wasi.md#typed-task-resources). The [install test](../../tests/helpers/wit-pollable-bytes.mjs) installs the author CLI from its npm archive offline. It builds ordinary Lean source, then builds again against the first release’s reviewed Binding IR. Both receipts select `native-wit-task-v1`.

The [C consumer](../../tests/fixtures/wit-pollable-bytes/consumer.c) uses the installed header and pkg-config file. It runs with no author tools on its path, after the original source and handoff are removed. The companion [canonical Wasm guest](wit-canonical-async-20261124.md#carry-binary-values-through-futures-and-streams) tests a different interface.

- **Tasks:** A rejected factory returns its binary EIO error and no owner. Two parked tasks retain distinct non-UTF-8 inputs after the caller clears them; the second completes first. Cancelling a third task and releasing its worker does not disturb either survivor. The package rejects an occupied error output, a null pointer with a nonzero length, and an over-budget input before creating an owner.
- **Cursors:** A refused second pull leaves the first pull intact. A nonempty binary item, an empty item and a typed binary step failure arrive in order. The Lean close counter records both early drop and terminal cleanup. An owned item remains readable after closing the session.
- **Callbacks:** The [Lean factory and worker](../../tests/fixtures/wit-pollable-bytes/Host.lean) can each request a callback. The C handler runs on the store owner in both cases. It returns a subspan of its borrowed argument, echoes an empty argument, or rejects with a one-byte NUL message borrowed from that argument. A malformed reply returns `INVALID` to the caller; a subsequent await delivers the corresponding factory- or worker-callback failure. Every registration’s context destructor runs once.

| Verified Packet archive | Bytes | SHA-256 |
| --- | ---: | --- |
| Ordinary | 59,225,487 | `b4df0c02bfe77dd9dd1b8cb1987087c9d44a829e760dac2e06f88e9a1f18093b` |
| Reviewed | 59,227,277 | `02bcc083b508111d527a5f762cf2dff25837017c907969cb65eb2fef79321472` |
