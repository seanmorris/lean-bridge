# Reviewed-IR corpus admission

The reviewed-IR path validates a supplied contract but cannot yet build an ordinary library from it. This milestone tests that distinction and fixes two cases where review decisions could be ignored.

## Corrections

Native source builds did not reject supplied `.binding-ir.json` files. The CPAN route could reach compilation despite a review document, and direct native compilation had the same omission. A regression with a valid Shop contract reached the Lean executable before the fix. Ordinary canonical builds, native builds, source entry capture and the shared elaborated compiler now reject these inputs with `reviewed-ir-build-unsupported`. CLI builds return `blocked`, exit code 2, before backend or compiler discovery.

Reviewed analysis also omitted `contracts` from its check for conflicting source configuration. It now rejects those settings alongside modules, exports, resources, arities and specializations. It does not silently replace review decisions with source configuration.

The repository's separately defined Alpha build retains its existing pipeline. Ordinary source builds without review documents retain compiler-owned metadata and their current package projections.

## Executed checks

The [admission suite](../../tests/type-corpus-reviewed.test.mjs) describes the two existing corpus libraries, Shop.Pricing and Telemetry.Readings, using independent reviewed contracts with 19 declarations each. It does not copy Alpha or import a production model generator.

```sh
source scripts/env.sh
npm run test:type-corpus:reviewed
```

All 15 tests pass. The enabled test invokes the actual CLI with a process environment that has Node but no compiler or backend on `PATH`. Analysis preserves both documents and reports no compiled environment, elaboration or theorem evidence. Every profile's build attempt must fail at admission, not from a missing tool. The two source projects, local dependencies and pinned offline Git dependencies remain unchanged, and no release directory appears.

The report at `build/type-corpus/reviewed-ir.json` records:

- Two libraries, 17 consumer profiles and 12 package targets.
- 38 analyzed declarations and 34 rejected build attempts.
- Zero installed runs, executed consumer cases or observed cells.
- 6,562 corpus gaps, including 697 cells with a reviewed-build rejection reason.

Fresh Lean 4.32.2 runs compile each library's proofs and produce its independent oracle. They establish that the source fixtures compile; they do not turn contract validation into reviewed-IR execution. The admission report binds its own implementation files in addition to the ordinary corpus identity, source snapshots and oracle identities. Tamper checks reject changed contracts, invented compiler claims, missing or duplicate profiles, wrong targets, generic tool failures, output directories, added archive claims and changed oracle results.

The 70-file admission identity is `d8abbce128ec3be76c0bbdf287603dbd5fd5e2da688eac6bc37f6e3cf7a9789b`. It includes the unchanged 56-file ordinary corpus identity `0448a59b9843db43ce3484a3ca7907ccec1b715f947910d87aca514dee20f207`. The report records Node 22.23.2 and the exact Lean compiler binary hash alongside each oracle.

Fast tests cover default and combined targets, `perl` as a CPAN alias, direct native/PHP entry points, cached forged interface claims, conflicting selectors, and multiple or malformed review files. Synthetic mutations test validators only and do not become execution evidence.

## Source-build regression

A separate five-profile run passes all 411 tests in 536.4 seconds. It rebuilds and installs both ordinary libraries for Python, Perl, JavaScript, TypeScript and PHP-Wasm, covering all three compiler transports. Its 620 catalog cases contain 596 executions and 24 explicit unsupported npm aggregate cases. It records 187 scoped observed cells and 6,375 gaps. PHP-Wasm additionally records 24 route/caller observations and 1,728 supplemental error/recovery checks.

The report is `build/type-corpus/node-javascript-node-typescript-perl-php-wasm-python.json`. Both reports revalidate against their recorded identities and coverage calculations. Re-reviewed builder source pins in the type inventory reflect the new admission guards; historical installed archive records and support states are unchanged. The inventory remains at 656 installed-tested cells and 29,530 required gaps.

Core checks pass with 1,133 tests and 55 toolchain-gated skips. Documentation checks pass 65/65, site/demo checks pass 111/111, and site type checking and production compilation pass. Native regression uses the explicit local glibc 2.36 test override; the production and CI floor remains 2.38.

## CI and next stage

The downstream workflow has a required `Reviewed IR admission corpus` job. It installs the pinned host Lean compiler, runs the suite and uploads `type-corpus-reviewed-ir-<commit>`. Missing reports fail the job.

The next stage must reconcile a supplied contract with fresh Lean metadata before generating adapters. It must reject incompatible signatures, ownership, effects, source identities and assurance claims, preserve the approved decisions in receipts, and test reproducible packages in source-free consumers. Allowing an `existing-validated` origin alone would not establish this correspondence.

VO 1217 remains in progress. This admission work does not complete its installed reviewed-IR acceptance or publish a registry package.
