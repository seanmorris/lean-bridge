# Required nominal Java and Kotlin package CI

The managed JVM job now requires ordinary/full, reviewed/full,
ordinary/result-only and reviewed/result-only Maven selections. Each selection
reproduces its package in two author roots, removes author sources before
installation, and runs both Java and Kotlin callers after installation,
physical relocation and removal of consumer sources.

`scripts/run-nominal-subtype-jvm-ci.sh` receives explicit Java, javac and kotlinc
executables. It resolves their paths, selects the matching Kotlin home and JAR
tool, removes ambient JVM options, sets one-thread build limits, and declares
glibc 2.38. An ambient floor override is rejected, including an empty override.
The runner executes the four selections serially, refuses existing output
directories and stops on any producer or checker failure. Original producer
stdout, stderr and partial records remain under `build/nominal-subtype-jvm-ci/`.

The workflow keeps the existing JDK 22.0.2 setup and checksum-verified Kotlin
2.2.0 distribution. The new step has a 45-minute limit; the existing 240-minute
job budget and earlier commands remain unchanged. An unconditional upload
retains complete and partial output. Both the managed observation summary and
its final enforcement step require the nominal gate to succeed.

## Independent checker

`scripts/check-nominal-subtype-jvm-ci.mjs` requires complete, zero-skip TAP for
one exact installed selection. Unexpected nested results, omitted totals,
wrong selections and failure markers reject.

The checker verifies the original package-set receipt and complete JAR,
including native library bytes. It derives the package-record reader from
actual JAR members and requires the exact retained filesystem inventory.
Existing validators check both build records, the original generator sources,
Java/Kotlin callers, compiler probes, Kotlin nullability diagnostics, all six
executions and unchanged deployment identities.

The checker measures the explicitly selected Java interpreter, javac version,
Kotlin compiler version and every compiler JAR. It compares those observations
with the producer records. Java and javac must belong to one JDK. Historical
scratch paths are compared as records, never used to locate current tools.
The complete JDK and Kotlin distributions remain trusted tools. Constructor
and source-entry counts and memory remain unmeasured for nominal acceptance.

## Validation

All four original handoffs at `70285c8cfc5ae0251adec4ba55a70ea2386a9869`
passed the actual standalone checker. These local checks used JDK 22.0.2,
Kotlin 2.2.0 and glibc 2.36 with an explicit 2.36 floor. They preserve the
original 24 executions, 75,732 checks, 12,384 native refusals, 78 host refusals
and 192 snapshot controls. No successful compiled producer was restarted.
Fresh hosted acceptance at the required 2.38 floor is pending.

- Final regression: 108 passed, zero failures and zero skips. Original TAP:
  `build/vo1444-jvm-ci-regression-r3-0.log`, SHA-256
  `84e1e1d6c7371ca94c593bec9ee653f18e7e81f91cac2d307216d7b1c8e78755`.
- Registered selection through `tests/component-refinement-mirrors.test.mjs`:
  nine passed without skips, SHA-256
  `07d3c6f453a82bbb7c5869779b65cd3b5ec23d0df1646a5943a8186b84511010`.
  This named selection does not claim a complete rerun of that root.
- Controls include 164 invalid TAP cases, 136 tool/package/record cases,
  23 JAR cases, 27 workflow cases, five tool-observation cases, nine shell
  success/failure scenarios, nine stale-output refusals and nine argument/floor
  refusals. Synthetic JAR members and stand-in tools are not installed evidence.
- Full ESLint, checked JavaScript, all sixteen generated reference checks,
  actionlint and Bash syntax passed. The resource guard paused later checks
  while host load exceeded six; it resumed without relaxing the limit.
- The four original-handoff checker runs, static checks, registered selection
  and final regression each verified 5,479 source fingerprints unchanged.
  Their complete records remain under `build/vo1444-jvm-ci-*`.

The first broader regression caught two historical comparisons using the live
workflow or inventory. The corrected checks reconstruct the authenticated
partition checkpoint and preserve all earlier command, artifact and mutation
checks. The original failure log remains at
`build/vo1444-jvm-ci-regression-r1-0.log`, SHA-256
`075fde0c1c36acba8f2ebfe003cd373aa686b3f77e8c806bf88f4e16680f8bc3`.

## Source history and next work

Eight exact transitions from `2f38c10b8f0937edeeef39b4e15515f70b66ddd3`
preserve earlier ledgers and archives. Only 92 existing workflow fingerprints
change in the support inventory. Its 500 evidence entries and 585 observations
retain their claims. Ledger SHA-256:
`ac8fb07e0eec9200d56922399fa2d047f5ea0ed41e7bfd7d0203abeedb6b9bea`.

The staged audit is `build/vo1444-jvm-ci-staged-audit-r1.json`. It checks all
changed Git blobs, reverses every transition to its exact predecessor, checks
the workflow-only inventory changes and reconciles the four actual checker
results with the original archive. Post-commit verification also checks that
the ledger writer refuses to rewrite the committed milestone.

Promotion of the demonstrated Java/Kotlin support cells and consumer guidance
follows this CI milestone. The remaining #1444, #1443 and #1446 requirements
stay open.
