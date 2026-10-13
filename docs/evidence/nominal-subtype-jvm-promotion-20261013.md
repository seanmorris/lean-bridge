# Installed nominal Java and Kotlin Subtypes

The Java and Kotlin guides now describe the tested `Nat` Subtype fields in
acyclic records, variants and aliases, including copied results that need no
input constructor. Both ordinary-source and independently reviewed packages
have full and standalone result-only installed checks.

The support inventory adds four field cells across the two languages and
authoring routes. It supplements eight existing parameter/result cells without
changing their earlier evidence. Ordinary Java/Kotlin share one observation;
their reviewed observations remain separate. Four new evidence references
bring the inventory to 504 entries and 587 observations.

## Original package evidence

The [original archive](nominal-subtype-jvm-20261013.md) retains four selections
from producer `70285c8cfc5ae0251adec4ba55a70ea2386a9869`. The
[index](nominal-subtype-jvm-20261013/index.json) has SHA-256
`ee5dfe4809453595b3d662d2624a0c50c4e93c908d63195176bbd0f9dc56e0e1`.
No installed producer was rerun for this documentation milestone.

The original 24 Java/Kotlin executions completed 75,732 checks, 12,384 native
refusals, 78 host refusals and 192 input-snapshot controls. They use JDK 22.0.2,
Kotlin 2.2.0 and an explicit Linux x64/glibc 2.36 package floor. Each package
reproduced from two author roots, installed offline after author removal, and
ran again after moving the consumer tree and deleting consumer sources.
Compiled probes check invalid callers and Kotlin nullability separately.

The [promotion helper](../../tests/helpers/nominal-subtype-jvm-promotion.mjs)
authenticates the complete archive, producer Git sources, generator closure,
package/model/consumer records, original launch and terminal records, and TAP.
It reads retained relative paths instead of reopening producer scratch paths.
The [tests](../../tests/helpers/nominal-subtype-jvm-promotion-tests.mjs) reject
missing or changed originals, invented scope, omitted profiles, altered
execution counts, overlapping observations and duplicate promotion. They
require exactly twelve changed cells, including four newly accepted fields.

## Validation and source history

The 25-root regression passed 231 tests with no failures. One unchanged
author-example compiler test remained explicitly gated; installed JVM evidence
comes from the original zero-skip executions above. Regression TAP:
`74769412043be07742e0b0c3bbc00b86065d741d93dea9ef51d14aaba544607b`.
The runner verified unchanged source fingerprints throughout the run.

The first broader regression exposed a workflow comparison predating the JVM
gate and a structural guide test still treating JVM nominal fields as pending.
The workflow test now validates the live required gate before comparing the
earlier partition. The guide test requires the new field evidence. Original
failed TAP remains in `build/vo1444-jvm-promotion-regression-r1-0.log`, SHA-256
`fb56ee34a0175b30ba62fafe6cdd2699459531243723611532c12e6618b9959e`.
An earlier focused run also caught an incorrect test expectation that the
rendered conversion table included inventory limitations.

The [history ledger](nominal-subtype-jvm-promotion-source-history-20261013.json)
records 28 exact transitions from
`58777508091f0e6b9b574cbfa2561c2c019b1570` and 187 existing source-pin updates.
Earlier promotion tests reconstruct their authenticated checkpoints; live
inventory and documentation tests require the new JVM observations.
The writer refuses a different predecessor or an already committed ledger.

Full ESLint, checked-JavaScript typecheck, all 16 generated reference pages,
workflow actionlint and shell syntax checks passed. The first full lint pass
found one overlong profile-list line in `tests/type-surface.test.mjs`. Its fix
only wraps that line; the parsed syntax tree is unchanged. The ledger records
the final bytes.

After that wrap, the final type-surface and eight promotion-history test roots
passed all 80 tests with no failures or skips. TAP SHA-256:
`305a3dc0ecfe110f2f18c37d5612a03f71d6afb5004b0950cbf6a4dce5f036e3`.
The registered component-refinement root also ran its five selected nominal
JVM promotion tests with no failures or skips. This named selection does not
claim a rerun of the full component-refinement suite. Each phase retained its
command and terminal result and verified all 5,489 source fingerprints.
Registered-selection TAP SHA-256:
`2392373930599f3a64ccb25763c1342d98913e75e01609b260244c029a4d7e89`.

The independent precommit audit verified all 35 selected files against their
staged bytes, reversed all 28 transitions to the Git predecessor, recomputed
the exact inventory and its 187 source-pin updates, and checked all 13,024
previously tracked evidence files against their original Git objects. Every
earlier evidence file is unchanged. The final ledger SHA-256 is
`dd7281d83e13741639cc4769d4eaaa9c888b4d6310de143d96fb1f5e160091e2`.

## Remaining scope

Other primitive-base nominal fixtures, refined callbacks, owned, recursive,
dependent and broader generic Subtypes remain assigned work. These original
runs do not measure constructor/source entry counts or memory, or establish
hosted glibc 2.38 acceptance. Complete JDK and Kotlin distributions remain
trusted tools. The archive retains non-native JAR members and compiled probes,
but omits native library binaries, complete JARs and consumer bytecode.

The [required JVM CI gate](nominal-subtype-jvm-ci-20261013.md) is committed
separately. VO #1465 owns this documentation milestone under #1444; #1466
continues nominal native PHP acceptance. The original #1220 scope remains open.
