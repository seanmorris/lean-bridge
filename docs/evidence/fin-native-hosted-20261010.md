# Native Fin products and fields: hosted evidence

This archive retains 78 original reports covering 90 host/runtime observations
from producer `ff71335c762628da47887bfd4f208e62c39b94b7`. It supplies the hosted
evidence for the remaining #1441 and #1442 requirements audit. It does not close
those tasks or change the support inventory.

The [downstream run](https://github.com/seanmorris/lean-bridge/actions/runs/37969725049)
passed all 46 jobs. Its Core and Performance runs also passed. The archive reuses
the ZIP files, job logs and GitHub metadata already retained in
[the generic-record Array archive](generic-record-array-hosted-20261010.md).
It copies each selected JSON member without changing its bytes and adds 75
original Git source snapshots. These are selected fixture, consumer, producer
and implementation files, not a complete transitive source archive.

## Coverage

| Fixture | Original reports | Host/runtime observations | Routes |
| --- | ---: | ---: | --- |
| Products and active result branches | 26 | 30 | Ordinary source and independent reviewed IR |
| Arrays of products | 26 | 30 | Ordinary source and independent reviewed IR |
| Records and active variant cases | 26 | 30 | Ordinary source and independent reviewed IR |

Each fixture runs in C, C++, Python, Rust, Ruby, .NET, Java, Kotlin, native PHP,
WIT/WASI and Perl. Python runs separately on 3.11.17 and 3.12.15. Perl runs on
5.36.3 and 5.38.2, each threaded and unthreaded. Python's report bytes can be
identical across versions. The verifier therefore checks the two interpreter
selections and their ordered, unskipped TAP executions in the original log.

The producer builds archives from two unrelated author roots and compares their
digests. It removes the author/build root before installing and exercising the
first package set offline. The second build establishes reproduction; it does
not constitute a second installed execution. Consumer compilers remain available
where required. The package archives themselves were not uploaded. Reports
retain their digests, sizes and package coordinates.

The hosted packages declare glibc 2.38. This is not execution on a minimum-libc
machine. The archive does not relabel older local 2.36 evidence.

## Dispatch and proof of rejection

Only C reports in this archive measure source and adapter dispatch. Their
test-only interposers count valid public and raw calls as positive controls.
Invalid public calls stop before adapter entry; invalid raw calls reach the
checked adapter without reaching the Lean source function. The verifier requires
the exact counter sequence for each fixture and both routes.

Other profiles execute public rejection/recovery tests, but these reports do not
measure their source or adapter entry counts. Separate historical measurements
remain separate evidence. No browser, PHP-Wasm, Subtype, recursive or generic
acceptance follows from these reports.

## Reproduce the archive check

From a Git checkout with the original producer commit available:

```sh
node scripts/archive-fin-native-hosted.mjs --check
```

The registered regression root also verifies the archive without Git history:

```sh
node --test tests/generic-record-array-ci.test.mjs
```

The receipt is [receipt.json](fin-native-hosted-20261010/receipt.json), SHA-256
`b33ffceea3afbb7584a00a6579f556716ddd3565f9e4707be968f75d95f39a2f`.
The verifier checks that digest before reading references, authenticates the
parent archive, compares extracted reports with their original ZIP members,
rebuilds fixture trees, checks consumer identities and refinement trees, and
matches actual commands with required report files and successful execution.

The remaining closure work is the requirement-by-requirement consumer audit,
reconciliation of current support cells and documentation, and any supplemental
tests that audit identifies. Report counts alone do not establish that every
original case has been exercised.

## Open original requirement: field and case diagnostics

#1442 requires the failing field/case path in diagnostics. The shared
`finRefinementWalk` in `src/backends/c/native-copied-values.mjs` retains the root
argument label during recursion. Its errors name `arg0` and the bound, even for
`Nest.inner.digit`, `Shape.circle.radius` or `Slot.maybe`. The generated-C tests
and installed Python consumer explicitly expect that shortened message.

Perl's installed consumer checks full paths, including array indices, and the
generated package documentation lists field/case paths. The other native runtime
diagnostics still need correction and installed acceptance. These historical
reports establish the old behavior and must remain unchanged when it is fixed.
