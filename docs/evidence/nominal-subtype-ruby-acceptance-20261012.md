# Installed nominal Ruby Subtypes

Producer: `d829cd1533907b9bf1f4a60a00e63c918655b2c7`.

All four selections passed: ordinary/full, reviewed/full,
ordinary/result-only and reviewed/result-only. Each reproduced the same gem
from two independent author roots, removed the sources, installed offline and
ran an unchanged public caller before and after moving the installed tree.
Execution used MRI Ruby 3.3.12 without a compiler on PATH.

The four installations and eight executions completed 25,192 checks and
4,128 expected rejections. Each execution also checked eight independent
snapshot mutations. Full-API executions performed 4,212 checks and expected
1,032 rejections; result-only executions performed 2,086 checks.

The caller exercises Nat Subtype fields in acyclic records and variants,
aliases, structural containers, distinct normalizing constructors at different
input sites, mixed Fin guards, unchanged caller inputs, exact rejection paths
and 1,000 repeated rejection/recovery rounds. The separate result-only API
exposes no checked-input exports and returns existing Lean values, including
100-bit Nat payloads. Ruby records carry copied values without proof fields.

## Original records

[The immutable archive](nominal-subtype-ruby-20261012/index.json) contains
238 original files plus its index. Index SHA-256:
`385e4ceab16932cc433346fb5763e2c2d3e3da2138377383da1899a3ac84c670`.

The archive retains both author models and receipts, source inputs, complete
gem text files, the MRI identity, archive-derived installation inventories,
installed specifications, execution output, start/end records and TAP. It also
retains 43 selected producer Git sources, including the complete 19-module
Ruby generator closure, six independent record checkers and the monitored
runner. Original gems remain in the corresponding
`build/vo1444-nominal-ruby-*-d829cd1-records/` handoffs outside `/tmp`.
The repository archive does not contain those binaries or complete toolchains.

| Selection | Original TAP SHA-256 |
| --- | --- |
| Ordinary, full | `6e0b1c6cc75a3461f8254fb9c29727080cbf8fe0fc2181bee8b0ee5b52c440ce` |
| Reviewed, full | `7e6e01fd4272f36e83a4ce827970b19a1a2a4343c56ab57abacac8bee3896299` |
| Ordinary, result-only | `5c281ff0893158c948e83b85a23d9f1cbf094e4f95f4bea6203241a964c5ba6d` |
| Reviewed, result-only | `35ccdf56a3519d114744f9a0cafdb4249ba992bfc9df4b8a63ccec3b1ca559ea` |

## Independent checks

The checker reconciles both compiler models with the independent contract,
regenerates Ruby sources from the frozen Git closure and checks retained
package bytes against the receipt. It verifies that the installation inventory
contains only the original gem payload, cache and specification, then checks
the unchanged caller and both execution records. Historical absolute paths
remain provenance; the checker never reopens them.

Ten archive and history tests passed without failures or skips. They include
478 missing/corrupted archive-file controls, 92 provenance controls and
506 selection-record, environment, package, compiler and execution controls.
Together these make 1,076 negative controls. TAP:
`build/vo1444-nominal-ruby-archive-focused-r1.tap`, SHA-256
`a7133c5b659c7a8bd2e998d299f0b6fd65d21f166f10bafd6cfa343a88e2fe15`.

An independent audit matched every archived byte to its original record or Git
source and checked all four retained gem binaries. It verified three exact
registration transitions while preserving prior evidence and the support
inventory at 488 evidence entries and 579 observations. Audit SHA-256:
`972049c93261d0c18870bdffc7133dfcdedfe8f4d23e2f2a19fe9801fb1619ea`.
[Registration ledger](nominal-subtype-ruby-archive-source-history-20261012.json)
SHA-256: `86b9037a01a9f37146d8dd17893320aaf6139f3d86cf529f8ea48acf7cceeb71`.

The registered component-refinement, checked-JavaScript, test-profile and
reference-documentation regression passed 136 tests with no failures and
21 explicit compiler/installed skips. TAP:
`build/vo1444-nominal-ruby-archive-registered-r1.tap`, SHA-256
`65358849fdefa993af6577a92d402b90fcf8c30a65590526c4a35a7041ae4cc2`.
Full repository ESLint, JavaScript typechecking and all 16 generated reference
checks passed. Original archived generator and license whitespace remains
unchanged.

## Remaining scope

These runs used Linux x64/glibc 2.36 and an explicit 2.36 package floor.
Constructor/source entry counts and memory remain unmeasured. Hosted release
floor acceptance, required recurring CI and support/documentation promotion
follow. Other primitive-base nominal fixtures, other host contexts and refined
callbacks, owned, recursive, dependent and broader generic Subtypes remain
within VO #1444's original scope. This archive does not close #1444 or #1220.
