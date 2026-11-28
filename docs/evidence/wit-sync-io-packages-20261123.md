# Installing synchronous WIT IO packages

Two Linux x86-64 archives built from the [Journal Lean package](../../tests/fixtures/native-sync-io)
passed the same independent C consumer. The ordinary project selected six
exports by name. The second project omitted that list and used a public
Binding IR review with its own documentation. Its archive preserved that
review byte-for-byte alongside the compiler evidence.

### Replay the retained archives

The [ordinary](wit-journal-replay-20261126/ordinary.json) and
[reviewed](wit-journal-replay-20261126/reviewed.json) replays verified the
original receipt and archive hashes below. Each compiled the exact recorded
C client sources and scalar helper header against the relocated package.
Both observed `wasmtime-io:27`, a shared counter value of two in the
successful custom-store run, and store discard and peer refusal in the
separate trap run. Set
`LEAN_BRIDGE_WIT_IO_HANDOFF` to a retained release,
`LEAN_BRIDGE_WIT_IO_EXPECT_REVIEW` to `0` or `1`, and
`LEAN_BRIDGE_WIT_IO_RESULTS` to the destination directory. Then run
`node --test tests/helpers/wit-sync-io-package.mjs`.

| Build | Archive bytes | Archive SHA-256 | Receipt SHA-256 |
| --- | ---: | --- | --- |
| Ordinary | 59,183,593 | `7b49afc8df851d82889979562cf2566fba362807451a557a289f50723e72ccd4` | `8fc480b93954804a0185c48ad3543155d79b06c059b897339b8431d2b1948187` |
| Reviewed | 59,184,931 | `b72223bd7701a177a39d502b9576772d134be9fd16b3ccffdec44f838ed40a3b` | `9d3a0a29611e8b97f11b1c65644d572be5e2655093a2ea450ce7c58255bc0016` |

For each archive the consumer ran `lean-bridge verify`, checked every extracted
file against its package inventory, checked the component against its WIT
world, then moved the installation. It compiled against the relocated
`pkg-config` entry; execution needed neither the Lean compiler nor the source
project. The 27 session checks include file IO, invalid arguments, returned
versus thrown `Except`, fork refusal, and result ownership after close.

A second consumer used its **own Wasmtime store**. A raw call to `bump`
failed before changing the counter. A guarded call changed it to two; a
separate generated session saw the same value. In a separate process a
world-conforming test component executed `unreachable` **after** calling
`bump`. The guard returned a trap, marked the caller-owned store for disposal,
and subsequent calls through the other session refused to use the retired
runtime. Neither component nor host library was substituted in the ordinary
success case.

The release CLI was also packed and installed with `npm install --offline
--ignore-scripts` in a new directory. It rebuilt Journal from a separate
copy of the source. The resulting archive and receipt had the exact ordinary
SHA-256 values in the table.

Three rejected projects produced no release directory: the public review
changed the return type of `Journal.count`; the author removed the required
filesystem grant; and the author selected a synchronous export as a task.

## Reproduce

Use Lean 4.32.2, wasm-tools 1.245.1, Wasmtime 42.0.1 and the host toolchain
described in the [publisher guide](../publish/wit-wasi.md#export-synchronous-io).
Run `npm run test:wit-sync-io-package`. Set `LEAN_BRIDGE_WIT_IO_EVIDENCE` to a
**new** directory to retain both handoffs. Set `LEAN_BRIDGE_WIT_IO_ORDINARY`
to an existing ordinary handoff to rerun the install checks and build the
reviewed route without rebuilding that first archive.

To check the author distribution too, set `LEAN_BRIDGE_WIT_IO_ORDINARY` and run
`node --test tests/helpers/wit-sync-io-repro.mjs`. This test packs and installs
the release CLI offline in a fresh directory, rebuilds Journal from new
source paths, and compares the verified receipt and archive identities.

The local evidence used `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36`; the normal
publisher floor is 2.38. The archives contain a native host and a component
that imports it. They are not standalone WASI executables, and no registry
publication is involved.
