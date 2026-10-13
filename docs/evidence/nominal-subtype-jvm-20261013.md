# Installed nominal JVM Subtypes

Producer: `70285c8cfc5ae0251adec4ba55a70ea2386a9869`.
Archive: `docs/evidence/nominal-subtype-jvm-20261013`.
Index SHA256:
`ee5dfe4809453595b3d662d2624a0c50c4e93c908d63195176bbd0f9dc56e0e1`.

## Executed acceptance

All four ordinary/reviewed, full/result-only Maven selections passed with
one test, zero failures and zero skips each. Two independent author roots
reproduced each package. After removing those roots, Java and Kotlin consumers
ran from the installed package, after physical relocation, and from unchanged
bytecode after removing the consumer source trees.

The 24 executions completed 75,732 checks, 12,384 native refusals, 78 host
refusals and 192 snapshot controls. The full fixture retains 26 exports; the
standalone result-only fixture retains 13. The checks cover nested nominal
records and variants, aliases, arrays, options, results, mixed Fin fields,
100-bit integers, distinct constructors at each input site, late failures,
recovery and unchanged caller inputs. Compiler probes separately verify public
API presence/absence and Kotlin null rejection with adjacent compiling controls.

Each original package was built for Linux x64 with an explicit glibc 2.36
floor, JDK 22.0.2 and Kotlin 2.2.0. This is local acceptance. It does not
establish hosted release-floor acceptance or constructor/source entry counts.

## Retained records

The archive contains 619 files plus its index: 550 selection records, 49
original Git source snapshots, seven checker sources, the original launch,
terminal and TAP records for all four selections, and the retained runner.
The complete 21-module JVM generator is restored from the producer revision.
Each full package has 34 generated files; each result-only package has 32.
The checker compares all of them with the original compilation record.

Every non-native JAR member is retained, including Java and Kotlin class files,
generated sources, metadata, licenses, manifests and receipts. These bytes were
extracted from the hash-verified original handoffs after execution. The archive
does not rebuild a JAR or replace an original observation. Native binaries and
the complete original JARs remain in the corresponding `/app/build` handoffs,
outside `/tmp`.

The producer removed its successful scratch consumers. Their bytecode identities
and execution records remain; those consumer binaries are not in this archive.
The component JAR still contains generated sources and provenance metadata.
The selected JDK and Kotlin distributions remain trusted tools. The installer
retains input/output identities rather than compiler stdout; the separate API
and nullability probes retain their compiler output and emitted class files.
The launch record did not hash the runner itself, but records the complete
frozen tracked source map and verifies no source changes at completion.

## Verification

The registered focused suite passes 12 tests with no failures or skips. Its
TAP SHA256 is
`9035797d91de1ee24bf1ae824c9c5dfe3ad67869951d0d593ab9ce728bd5ef27`.
Parent-suite registration passes 11 tests with no failures and five explicit
compiler/installed skips. Its TAP SHA256 is
`9957b9ed5840776e38eb054f18d9fa79d3804f70ad92c149dd4338012e136bfb`.
Those skips are separate from the four original zero-skip installed producers.

Adversarial checks reject all 1,240 missing/corrupted archive files and index
cases, 80 coordinated provenance changes, and 1,406 missing-record and semantic
changes. Semantic controls cover both execution records and their report
copies, compiler commands/environments, Kotlin diagnostics, package metadata,
resource floors, mixed Fin bounds and constructor decisions in both author
models. Original bytes remain unchanged throughout these controls.

The five-root regression passes 115 tests with zero failures or skips. TAP
SHA256:
`0191331dec5125de71c914dace8a43970a1cbfe4d27bf9a5665c674120339cd9`.
Full lint, checked-JavaScript type checking and all sixteen reference checks
pass on the same frozen sources. The staged audit compares each retained
package member independently with system `unzip`, compares the other records
with their original `/app/build` files and matches all 49 source snapshots to
Git. It also verifies every staged blob and preserves all earlier evidence,
production code, workflows and support-inventory bytes. The only edit to an
existing source file registers the new archive tests.

This milestone does not promote support cells or add required hosted gates.
The support inventory remains 500 evidence entries and 585 observations.
Required recurring acceptance and exact support/documentation updates follow.
