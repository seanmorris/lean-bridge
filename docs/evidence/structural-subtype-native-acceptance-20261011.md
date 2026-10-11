# Structural Subtype C and C++ installed execution

Both ordinary-source and independently reviewed packages passed at producer
`d3f12b2afe15973e58d66de81c7646e4b2020bdb`. Each route built from two author
roots and reproduced the exact native model, package receipt and C/C++ archive
digests. The harness deleted both author/build trees before offline
installation. C passed 4,049 checks and C++ passed 4,047 checks, then both
unchanged executables repeated those checks after the entire installed tree
moved. Archive-authenticated package contents remained unchanged.

The independent fixture covers Array, List, Option, Prod, Except, nested
combinations, primitive Nat/String/UInt8 Subtypes, transparent aliases with
different per-site constructors, a closed List specialization, and mixed Fin
branches. Callers verify normalized output, empty/absent values, first/middle/
last invalid positions, embedded-NUL strings, values wider than 64 bits,
late rejection with complete input preservation, and 1,000 rejection/recovery
pairs. Public errors identify the failing element and constructor or Fin bound.

Each route passed three tests without failures or skips. Ordinary execution
took 435.7 seconds; reviewed execution took 428.4 seconds. The respective TAP
SHA-256 values are:

- Ordinary: `2771d1c9393e267b90c0c2db37d23c60125264d6418fdd1fbd013ea44aaacd3b`.
- Reviewed: `e9931974baa2c40a0c4929260333146a3c97bee7a98d8f15185326da0d97138b`.

Both runs used one CPU-3 producer slot and a one-second disk guard. Minimum
free space was 10,523 MiB and 10,516 MiB respectively; neither guard stopped
the run. Successful temporary author and consumer directories were removed
after the original reports were retained.

## Retained records

[The immutable archive](structural-subtype-native-20261011/index.json) holds
66 files: both original runs, their models/receipts/callers/execution records,
the runner, the independent report checker and 24 exact Git producer sources.
Index SHA-256:
`d67872f878db83b7ba1c6992b7d014a31738505b32ae6edd1d32675f5bd6c292`.

The independent checker reconciles each compiled contract with the authored
review, authenticates source and caller bytes against the producer commit,
checks both build identities, and binds installed and relocated results to
their reports. Tests reject each missing or corrupted archived artifact and
coordinated changes to isolation claims, counts, dispatch claims and replay
results.

## Remaining work

These are local glibc 2.36 executions. Constructor/source entry counts and
memory usage are unmeasured. The archive stores package digests, not package
binaries or full toolchain closures. It does not establish hosted release-floor
acceptance or other languages and positions.

The separate native entry probe, npm/strict TypeScript installed execution,
remaining native/browser/PHP-Wasm/Perl profiles and recurring CI remain
required. No support-inventory cell is promoted by this archive. Nominal,
callback, owned and broader generic Subtypes remain in VO #1444's original
scope; the other open #1220 workstreams are unchanged.
