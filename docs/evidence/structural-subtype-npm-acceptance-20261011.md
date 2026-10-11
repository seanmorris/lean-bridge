# Structural Subtype npm and TypeScript installed execution

Ordinary-source and independently reviewed packages passed at producer
`8a114eff75094d760874f422996213dd37271613`. Each route reproduced the Binding IR,
receipt and both component/runtime archives from two author roots. The harness
deleted both author/build trees before installing the archives with npm's
offline and ignore-scripts options, empty cache and isolated configuration.
Consumer PATH contained only Node; Lean and runtime build paths were unavailable.

Each JavaScript execution passed 3,028 checks and 1,020 expected rejections.
Strict TypeScript passed with `skipLibCheck: false`. The harness moved the
entire installed tree, repeated both consumers and checked every package-owned
file against the original archive contents before and after execution. Caller
bytes also remained unchanged. npm's cached update notice is retained in the
original installation output; it is not an installation failure.

The twelve-export fixture covers Array, List, Option, Prod, Except, nested
combinations, Nat/String/UInt8 Subtypes, aliases with distinct per-site
constructors, a closed generic specialization and mixed Fin branches. It checks
normalization, empty/absent values, first/middle/last invalid positions,
embedded-NUL strings, wide integers and 1,000 late-rejection/recovery pairs.
Both rejected input trees are compared with their complete pre-call snapshots.
Fin errors identify the exact failing path and bound. TypeScript rejects
number-for-Nat inputs, fabricated proof objects, wrong result branches and
bigint-for-UInt8 inputs.

Both installed selections passed one test without failures or skips:

- Ordinary: 101.2 seconds, TAP SHA-256
  `a275201deacb64c5b63c7ae27b06cc5b5d466428099ea7323ab2c8d205d1e7e4`.
- Reviewed: 102.5 seconds, TAP SHA-256
  `4211c98f3b61a7c879dd659332aa8ce68735d193cc15d153041ddf57c6f6cd65`.

The one-second disk guards recorded minima of 11,103 and 11,100 MiB respectively.
Neither stopped the run. Successful temporary trees were removed after recording
the original results.

## Original failures and repairs

The archive retains both earlier failed ordinary attempts, their partial
compiler/installation records, original callers and source snapshots:

1. `ec5902f` built and installed the packages, then looked for
   `node_modules/undefined`. Receipt archive entries use `package`, not `name`.
   `ec568c0` derives installation names from the extracted manifests and checks
   their names and versions against independent expectations and the receipt.
   Ten negative controls exercise missing or mismatched identities. The same
   commit documents the TypeScript fixture for the repository's lint rules.
2. `ec568c0` reached consumer execution, then failed an incorrect error-message
   expectation. The validator says `must be bigint below`, including the complete
   element path. `8a114ef` checks that exact diagnostic and adds a wrong-path
   negative control. A diagnostic replay passed before the new installed runs;
   that replay is not counted as source-free installed acceptance.

## Retained records

[The immutable archive](structural-subtype-npm-20261011/index.json) contains
126 original records and source snapshots, plus its index. It retains all four
attempts, the runner, checker, 26 selected successful-producer Git sources and
eight failed-producer snapshots. Index SHA-256:
`24b189f8e95f6eefb1090c8766e666507ea52afe14dc3b66aaad2a2534069213`.

The independent checker reconciles the authored review, compiler adapter trees,
copied-compound private ABI version 6, source input hashes, build plans,
provenance, receipts, installed file hashes and both actual execution records.
The runtime's package ABI identity remains separate from the private component
call ABI. Archive tests reject missing/corrupted originals and coordinated
changes to isolation, constructor choices, execution counts and dispatch claims.

## Remaining work

Constructor/source entry counts and memory usage are unmeasured. Package
binaries and complete toolchain closures are not stored in this archive.
Browser, PHP-Wasm, other host profiles and required recurring CI need their own
acceptance. No support-inventory cell is promoted here. Nominal, callback, owned
and broader generic Subtypes remain in #1444's original scope.
