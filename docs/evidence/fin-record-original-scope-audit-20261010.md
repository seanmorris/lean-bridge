# Native Fin fields: original acceptance audit

This audit maps VO #1442's original requirements to the implementation and
retained execution evidence. Its scope is plain, non-generic, non-recursive
records and variants containing `Fin`, including the existing copied
containers, products and result branches. The broader #1220 work remains
open.

## Requirement checks

| Original requirement | Evidence |
| --- | --- |
| Record and variant fields, nested records, Array/List/Option, products and Except | The thirteen `FinRecords` exports run through all eleven native public APIs on ordinary and reviewed routes. The [hosted archive](fin-native-hosted-20261010.md) retains 26 record reports and 30 host/runtime observations. |
| Bounds on Binding IR definitions, with no invented declaration-site bounds | `tests/native-fin-records.test.mjs` compares all six nominal definitions and their exact trees, then checks declaration extensions and independent reviewed reconciliation. |
| Private erased mirrors, checked Fin proofs and result projections | The same root checks all six generated mirror types, decidable proof branches, nested checks, result erasure and one source call per export. Real Lean compilation and installed calls exercise those adapters. Plain unrefined helpers retain their existing bytes. |
| Raw C checks before allocation and source dispatch; only active variant branches | Generated-C checks establish guard ordering for nested and late fields. Installed C dispatch probes distinguish public entry, raw adapter entry and Lean source entry, with nonzero valid-call controls and a missing-interposer refusal. Both source routes retain the exact nine-row sequence. |
| Field, case and element-index diagnostics, including generated documentation | The [diagnostic repair and installed batches](native-fin-diagnostic-installed-20261010.md) cover C/C++, both Python floors, Ruby and JVM; the [remaining native batch](native-fin-diagnostic-installed-20261010/rust-dotnet-php-wit.md) covers Rust, .NET, PHP and WIT. The original hosted Perl consumers already require full paths. Generated Ruby, Perl and shared native documentation checks require the same paths. |
| Source-located refusals for unsupported generic, recursive and callback-bearing definitions | The [fresh-Lean refusal audit](fin-nominal-refusals-20261010.md) preserves the original recursive diagnostic failure and its corrected run. All three original cases now identify the declaration, file, line and column before output. Registered cases also check recursive results and wrapped recursive types; an unrefined recursive-graph positive control still passes. |
| Independent review; tightened, loosened, moved, omitted and active-case constraints fail before output | The [compiled review archive](fin-record-review-omission-compiled-20261010/index.json) retains seven mutations: tightened Tile, moved Tile field, loosened Nest, tightened Shape case, loosened Gate Fin 0, omitted Tile and omitted Shape constraints. Every mutation fails fresh reconciliation before creating output. The zero-bound supplement adds three changed field/collection reviews. |
| Fin 0 in empty, absent and inactive positions versus populated, present and active positions | Original `Slot` and `Gate` cases cover absent/present and inactive/active branches. The [zero-bound collection matrix](fin-record-zero-native-20261010.md) adds empty/populated Array/List fields and collections of records across all fifteen runtime selections, on both routes, with 2,046 assertions per consumer. |
| Later-field failure after heap-backed fields, input immutability before restoration, large values and recovery | `Late` contains String and Array Nat before its bounded field. Original public consumers preserve caller values through rejection and run 1,000 recovery pairs. The zero-bound consumers independently snapshot rejected nested inputs before restoring them and include huge naturals and first/middle/last failures. |
| Stable public names through aliases and relocated deterministic archives | The [installed alias supplement](fin-record-alias-native-20261010.md) changes the Lean signatures to record/variant aliases while using unchanged public C/C++ callers. Both ordinary and reviewed routes pass. Every installed matrix compares archives from two unrelated author roots and removes author/build staging before installation. |
| All native hosts, both Python floors and four Perl ABIs; independent public declarations | Original hosted and supplemental installed matrices cover C, C++, Python, Rust, Ruby, .NET, Java, Kotlin, native PHP, WIT/WASI and Perl. Python 3.11/3.12 and Perl 5.36.3/5.38.2 threaded/unthreaded remain separate selections. Consumers compile against the installed public headers/classes where applicable; C/C++ and JVM builds treat warnings as errors. |
| Preserve original artifacts and exact source transitions | Original failed and successful receipts remain unchanged. Subsequent diagnostic, review-omission, zero-bound and [nominal-refusal histories](fin-nominal-refusal-source-history-20261010.json) retain exact predecessors. Alias acceptance adds a new archive without rewriting earlier observations or promoting unrelated support cells. |

## Evidence limits

The original hosted matrix ran on GitHub Actions. New diagnostic,
zero-bound and alias supplements ran locally with glibc and configured
floor 2.36. They do not establish execution on a minimum-platform machine.
Only the separately instrumented C runs establish record/variant source
and adapter counts; other hosts establish public rejection and recovery.

The alias supplement covers C/C++; the full nominal-field and Fin 0
matrices cover all native hosts. Selected source snapshots are not a full
build dependency closure. Original package sizes and digests are retained,
but the harness removed binary package archives after execution.

Generic and recursive refined definitions, dependent shapes, reviewed
Subtype and PHP-Wasm remain governed by the other #1220 tasks. The JVM/GDB
15 exit failure belongs to the separate container-dispatch acceptance
under #1427. None is counted as completed by this audit.

## Regression entry points

The first closure regression caught a historical promotion test that had
not applied the later nominal-diagnostic source transition. The
[alias-closure history](fin-alias-closure-source-history-20261010.json)
records six exact transitions and 78 source-pin refreshes for that test
repair. It changes no evidence claims or support observations. The failed
first regression remains in the local build logs.

```sh
node --test --test-concurrency=1 \
  tests/native-fin-records.test.mjs \
  tests/native-fin-record-zero.test.mjs \
  tests/generic-record-array-ci.test.mjs \
  tests/type-surface.test.mjs \
  tests/documentation.test.mjs
```

These roots authenticate archived execution and test current generation,
contracts and documentation. Environment-gated installed tests remain
skipped in this default command; the linked original runs provide their
execution evidence.
