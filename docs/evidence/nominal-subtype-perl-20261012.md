# Nominal Subtypes in installed Perl packages

Producer: `875fbc9fb3191ad9eea959499abca5c01e631394`.
Archive: [nominal-subtype-perl-20261012/index.json](nominal-subtype-perl-20261012/index.json).
Index SHA-256: `6d893820aed83eedaff7f56d4b93c7f3a5aaaf31fc26f94b8c1aa8039c4c8b60`.

All four selections passed: ordinary and reviewed author routes, each with a
full API and a standalone result-only API. Each selection reproduced two
independent author roots and identical package archives. The harness checked
that author inputs remained unchanged, removed both author trees, and installed
the packages without a Lean compiler.

Each selection covered Perl 5.36.3 and 5.38.2, threaded and unthreaded. Each ABI
used both `prebuilt-only` and `build-xs` installation. The harness ran the
unchanged caller before and after physically moving the installed consumer,
checking that installed bytes remained unchanged. That gives 32 installations
and 64 executions.

| API selection | Exports | Checks per execution | Expected rejections per execution |
| --- | ---: | ---: | ---: |
| Full | 26 | 4,212 | 1,032 |
| Result-only | 13 | 2,086 | 0 |

Across all executions: 201,536 checks and 33,024 expected rejections. Each
execution also completed eight snapshot controls. Results include 100-bit Nat
values, mixed Fin fields, nested records, aliases, collections, active variant
cases, per-use constructor choices, complete input snapshots, exact diagnostics
and repeated rejection/recovery. Result-only callers assert that all thirteen
input operations are absent and consume results without input constructors.

## Independent verification

The archive contains 633 files plus its index: complete original run records,
models, package and install receipts, public PM/XS files, installed-file
snapshots, original author inputs, selected producer sources, the complete
JavaScript generator import closure, and checker snapshots. The checker reads
archive-relative bytes. Recorded absolute tool paths are provenance and are
never reopened.

The checker compares the named author contract with native positional refinement
trees independently of the producer's lowering. It checks the selected review,
source and compiler identities, both reproducible builds, every ABI and delivery
mode, both execution results, and runtime/component dependencies. It regenerates
the public Perl and XS files using the producer's exact Git sources, including
all transitive imports and the SPDX data file.

Five evidence tests passed without skips. Negative controls cover:

- 1,268 missing or corrupted archive files, including the index.
- 80 coordinated changes to invocation gates, TAP, scheduling and terminal state.
- 374 changes to compiler decisions, author isolation and actual execution records.
- 192 package/API/ABI substitutions with recomputed manifest, trace, receipt and
  installed-file hashes.

Evidence-test TAP: `build/vo1444-nominal-perl-evidence-r2.tap`.
SHA-256: `ce238a355e64448b08182ce2707956d2d2b691dcacc870fc9941d4a94fb67373`.

Caller/source and test-registration regression passed eleven tests, with four
explicit installed gates skipped. Those skips are separate from the four actual
producer runs above, which passed without skips. Regression TAP SHA-256:
`865b7264b4b6dd71d403b0839147dc8a90af1e58c8d4376777dbaed334677f50`.
Full repository lint, checked JavaScript and all sixteen generated reference
checks passed. A separate audit matched every archived byte to its original
run, producer Git blob or checker source and confirmed that tracked files were
unchanged. Audit SHA-256:
`726563f401f358014ceae085b3266744a718cdb35686d522017897edfb306f49`.

## Scope and follow-through

These are local Linux x64/glibc 2.36 observations, with an explicit package floor
of 2.36. They do not establish hosted release-floor acceptance. Constructor and
Lean source entry counts, memory usage, other primitive bases, callbacks, owned
values and recursive nominal types remain unmeasured by this fixture. Package
binaries and complete toolchain closures are not retained; their original
receipts and hashes are retained.

All four producers used one CPU, nice level 19, idle I/O and one Lean thread.
The runner required at least 2,048 MiB free disk and available memory at launch
and stopped below 768 MiB. GMP invokes `make -j2` internally, still within the
single-CPU process tree. No resource stop occurred.

Register these tests in the normal suite, add recurring installed CI gates, and
promote only the observed support cells with matching consumer documentation.
This archive alone changes no support-inventory claim. The broader requirements
of VO #1444 and #1220 remain open.
