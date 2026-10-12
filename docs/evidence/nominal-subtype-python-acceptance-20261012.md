# Installed nominal Python Subtypes

Producer: `08add61bd0668060833cf7f107aeea33b6939b48`.

All four selections passed: ordinary/full, reviewed/full,
ordinary/result-only and reviewed/result-only. Each reproduced the same wheel
from two independent author roots, then installed that wheel on CPython
3.11.16 and 3.12.14. The unchanged caller ran before and after physically
moving each installed consumer tree. Installation was offline; execution had
no author sources or compiler on PATH.

The eight installations and sixteen executions completed 50,384 checks and
8,256 expected rejections. Each execution also checked eight independent
snapshot mutations. Full-API executions performed 4,212 checks and expected
1,032 rejections; result-only executions performed 2,086 checks.

The caller exercises Nat Subtype fields in acyclic records and variants,
aliases, structural containers, distinct normalizing constructors at different
input sites, mixed Fin guards, unchanged caller inputs, rejection paths and
repeated failure/recovery. The separate result-only API has no input
constructor choices and returns existing Lean values, including 100-bit Nat
payloads. Generated Python dataclasses carry values without proof fields.

## Original records

[The immutable archive](nominal-subtype-python-20261012/index.json) contains
311 original files plus its index. Index SHA-256:
`ec5958fd35464591969afb0198ed5516602658b5e1644b5b68310a1321127d67`.

The archive retains both author models and receipts, source inputs, complete
wheel text files, both interpreter identities, fresh pre-pip environments,
original pip metadata, installed-file hashes, execution output, start/end
records and TAP. It also retains the selected producer Git sources, the
19-module Python generator closure, six independent record checkers and the
resource-bounded runner. The archive writer checks each original wheel's hash
and receipt before recording it. Original binaries remain in the corresponding
`build/vo1444-nominal-python-*-08add61-records/` handoffs outside `/tmp`;
the repository archive does not contain those binaries or complete toolchains.

| Selection | Original TAP SHA-256 |
| --- | --- |
| Ordinary, full | `19014d5f8229cfbb076403422058b7e69def9c3ac9bf7c49eef92ff24a54dcd1` |
| Reviewed, full | `854bf20e92c67d7b10dbf6055d8bd495768e2794e259e0b5b629f08232f9cbde` |
| Ordinary, result-only | `1e482d8c6f6912f98471a79e770dced2f6c3005623fb5f1d51978a94dea48164` |
| Reviewed, result-only | `519e47ed9c988346c3da54352e9e054ce2f495294ae9761dbcbd10d6a8e0bcaa` |

The failed first inspection at `9cac3f7` and its diagnostic replay remain
separate from these clean compiled runs. The
[harness note](nominal-subtype-python-harness-20261012.md#inspection-order-repair)
records the library-map ordering defect and its regression test.

## Independent checks

The checker reconstructs compiler decisions from both author builds and the
independently authored review. It regenerates Python source and type stubs from
the frozen Git closure, checks every retained package byte against the receipt
and wheel RECORD, and derives the installed environment from the pre-pip
baseline plus the receipt and named pip metadata. It never reopens historical
absolute paths to authenticate a saved environment.

Four archive tests passed without skips. They include 624 missing/corrupted
archive-file controls, 88 provenance controls and 706 selection-record,
environment, coordinated-package and compiler-model controls. Together these
make 1,418 negative controls. TAP:
`build/vo1444-nominal-python-archive-regression-r1.tap`, SHA-256
`862a9a967a7999a6032d10041189ff0c129038daa4374586e87d8ea7f78c87c9`.

Six focused source-history checks passed without skips. The
[archive registration ledger](nominal-subtype-python-archive-source-history-20261012.json)
records three exact transitions and preserves the existing support inventory
at 484 evidence entries and 577 observations. Ledger SHA-256:
`4f78dfe8d2e9fc645c438e6ca8a53e2905f00d49839fd2019a1fd2bfe2da95d6`.
Targeted ESLint and repository JavaScript typechecking passed.

The normal `component-refinement-mirrors.test.mjs` root imports the archive
checks and registration tests. Compiled producers remain explicitly gated;
source-only suite skips do not count as installed acceptance.

The registered component-refinement and checked-JavaScript regression passed
94 tests with no failures and 17 explicit compiler/installed skips. TAP:
`build/vo1444-nominal-python-archive-registered-r1.tap`, SHA-256
`6332ef1dd90d20b9777cb302401e7dcd890b0a2137b03deec501639505dd5844`.
All fifteen reference-documentation and test-profile checks also passed
without skips. Their TAP SHA-256 is
`2efde4042eafa79ca5ab5fe0c078e754cc6122ad7b1a95cbd3dfa3ea4d2bab21`.
Original archived generator and license whitespace remains unchanged.

## Remaining scope

These runs used Linux x64/glibc 2.36 and an explicit 2.36 package floor.
Constructor/source entry counts and memory remain unmeasured. Hosted release
floor acceptance, recurring CI and support/documentation promotion follow.
Other primitive-base nominal fixtures, other host contexts, and refined
callbacks, owned, recursive, dependent and broader generic Subtypes remain
within VO #1444's original scope. This archive does not close #1444 or #1220.
