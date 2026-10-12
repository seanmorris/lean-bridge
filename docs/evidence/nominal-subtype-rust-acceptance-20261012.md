# Installed nominal Rust Subtypes

Producer: `5f3dd63b943efa9d5e49d2683da8ab2ebc7d2e59`.

All four selections passed: ordinary/full, reviewed/full,
ordinary/result-only and reviewed/result-only. Each reproduced the same crate
from two independent author roots, removed those roots and installed offline.
The unchanged executable ran in the installed tree, after moving that tree,
and after moving only the executable and deleting the complete consumer tree.

The four installations and twelve executions completed 37,788 checks,
6,192 expected rejections and 96 independent snapshot controls. Each full-API
execution performed 4,212 checks and expected 1,032 rejections. Each
result-only execution performed 2,086 checks. Every execution included eight
snapshot controls.

The public caller inspects actual Rust structs, enums and `BigUint` values,
including 100-bit payloads. It does not trust generated equality or
serialization. It checks per-use normalization, repeated record fields,
active variant branches, aliases, nested structural containers, Fin guard
ordering, unchanged borrowed inputs, exact diagnostics and 1,000 repeated
rejection/recovery rounds. The separate result-only crate rejects all 13
checked-input imports and the input-only `Pair` type with Rust error `E0432`.

## Original records

[The immutable archive](nominal-subtype-rust-20261012/index.json) contains
351 original files plus its index. Index SHA-256:
`8fc801f8f1e6e1af7c4e6844ded44a46b700702b11ba979071cef0b194ae5495`.

The archive retains both author models and receipts, source inputs, complete
crate text files, Rust and Cargo identities, Cargo metadata, locks,
compiler diagnostics, installation records, execution output and original
start/end records and TAP. It includes 50 selected producer Git sources,
the complete 20-module Rust generator and its dependency-lock resource,
eight independent checkers and the monitored runner.

The fourteen dependency checksum manifests per selection are original members
of the hash-verified dependency handoffs. The archive process extracted them
after the successful runs and checked every dependency member against its
manifest. They supplement the producer records without rewriting them.

Original crates and dependency archives remain outside `/tmp`, in the
corresponding `build/vo1444-nominal-rust-*-5f3dd63-records/` handoffs.
The repository archive omits those binaries and complete toolchains.
Successful scratch cleanup removed the source-free executables after the
harness verified their unchanged digests and results.

| Selection | Original TAP SHA-256 |
| --- | --- |
| Ordinary, full | `af5a8f95a85800491309cc41e104005ec5ef646ce406b3de73dacbaa44ab22ea` |
| Reviewed, full | `cb191b7450d42650a24399350120e33a7047694f01c367cfd310e963277039f1` |
| Ordinary, result-only | `13f7f009d1dcc147728a53ef49e3f2339edf39ea0c3fada234ca694801aed22c` |
| Reviewed, result-only | `af0876b49bf28ae7110fb516c573338689d8d0ed825e3aa65018ba95c13e3ded` |

## Independent checks

The checker reconciles both compiler models with the hand-authored contract
and regenerates package sources and the dependency lock from the frozen Git
closure. It verifies the native-library identities and every retained package
file, then checks Cargo's exact registry packages, resolved dependency graph,
installed paths, compiler environment, build output and API diagnostics.

The consumer uses an empty private Cargo home, offline resolution, one build
job and a link-only driver. The original producer rejected thirteen forbidden
C/assembly/response-file inputs to that driver. Replay has no Lean, C or Rust
compiler available. The checker treats historical absolute paths as recorded
provenance and never reopens them.

Eight focused archive and history tests passed without failures or skips.
They include 704 missing/corrupted archive-file controls, 92 provenance controls
and 936 selection-record, environment, package, compiler and execution controls.
Together these make 1,732 negative controls. Original captured TAP:
`build/vo1444-nominal-rust-archive-focused-r1.log`, SHA-256
`b4b1366d3d00ff21572d211f3e27205b72ccac5b5aa039fe957ae11172b3b239`.

The [registration ledger](nominal-subtype-rust-archive-source-history-20261012.json)
records three exact transitions from the producer revision. Earlier evidence
and the support inventory remain unchanged at 492 evidence entries and
581 observations.

A separate audit matched all 351 archived files to the original records,
dependency archive members or Git sources. It checked every file in each of
the four original crate archives, including all sixteen native-library
members, and verified the three registration transitions. Audit SHA-256:
`90d7bd0a5bdec9941660b50c58902869b642cb9d1908d71526a16afc6248e4a3`.
Registration ledger SHA-256:
`5863f41fc44b8fc2604231f438e01fae7ec891f9c599b5a17bbdeba2c9720cbc`.

The registered component-refinement, test-profile, type-surface and
type-surface-documentation regression passed 248 tests with no failures and
25 explicit compiler/installed skips. Captured TAP:
`build/vo1444-nominal-rust-archive-registered-r1.log`, SHA-256
`f2fb31695a495aa08b1518754086a7afdb1a96480da8cc5d92912d4094b37fe0`.
Full repository ESLint, JavaScript typechecking and all sixteen generated
reference checks also passed. Staged Git blobs preserve every archived byte,
including original generator and license whitespace.

## Remaining scope

These runs used Rust and Cargo 1.90.0 on Linux x64/glibc 2.36, with an explicit
2.36 package floor. Constructor/source entry counts and memory remain
unmeasured. Hosted release-floor acceptance, required recurring CI and
support/documentation promotion follow. Other primitive-base nominal fixtures,
other host contexts and refined callbacks, owned, recursive, dependent and
broader generic Subtypes remain within VO #1444's original scope. This archive
does not close #1444 or #1220.
