# Native acceptance CI assertion repairs

Predecessor: `70285c8cfc5ae0251adec4ba55a70ea2386a9869`.

## Failure and reproduction

Downstream run `38386497742`, job `115259485305`, failed in the ownership
workflow assertion at revision `5a4386e`. The assertion counted the command
across the entire workflow and required two occurrences: its executable
line and its duplicate in the consumer summary text. The CI partition kept
the executable command in the required values job and removed the duplicate
summary text. The stale assertion therefore reported `1 !== 2`.

The original job log contains 773,773 bytes; SHA256:
`0f596f1c98574f47023fcbe256ca3da1df8dc92ef37d0a6bae2a595ce22d26af`.
The unchanged local assertion fails with the same result. Original local TAP
SHA256:
`fb3b495b7df32cd31cc5d3ffc65681895dbe8aaa89b0e4d2717f204a43803ff7`.

The actual hosted native ownership probe passed 111,963 checks across 22
exports, depth 128 and 96 allocation failures, with zero live allocations
or identities. Its sanitizer and four deliberately broken lifetime controls
also passed. The shell step failed because of the workflow assertion. Later
commands in that step still require a fresh hosted run.

Core run `38386497452`, job `115259482738`, reported ten failures: the same
nine ownership workflow assertions and a nominal CPAN historical comparison
that still expected the old 60-minute shared compiler budget. The original
core log contains 2,290,510 bytes; SHA256:
`2c2db392393b7ccacc7239022c36601bc2c9b43656c757a6b133c4eb92ca1e09`.
The unchanged CPAN comparison was reproduced locally. Original TAP SHA256:
`8c7c37204eb19404fabe9f8b9dfd4d3cf683616b4471bedde62083d819620331`.

## Repair

The nine ownership assertions now use one helper to select the required values
job with the existing partition checker. They require each executable command
exactly once, its nonempty-report checks and its artifact paths. The partition
checker also requires the unconditional upload and the blocking combined
C/C++ summary gate. Archived unsplit workflow checks retain their original
command and summary requirements.

Nine controls reject removed, disabled, commented or duplicated commands,
missing reports or uploads, optional execution and a permissive summary gate.
The CPAN comparison reverses only the authenticated compiler-budget transition
before comparing the original workflow. A forward comparison still requires
the current 90-minute budget. Four additional controls reject restoring the old
budget, substituting another budget, changing another job or introducing an
unrecorded edit. All 23 existing CPAN workflow refusal controls remain active.

The native probe, production code, workflow commands and support inventory
remain unchanged. The repair does not change a timeout, omit a producer or turn
a failing requirement into a skipped check.

Twelve exact source transitions preserve the original ownership receipts and
the JVM harness checkpoint. Ledger SHA256:
`352318f4c6e4bd79b88e99903aa6eb84ea761f8d5803adf3efd0d6bc098fc716`.

## Validation

The final focused suite passes 14 tests with no failures and one explicit
installed-native skip. TAP SHA256:
`01ea8155b451fc11b8f52b2d90e4ea561f13329842726fd5b9d35f9126585862`.
The expanded 20-root ownership, historical-evidence, documentation and
type-surface suite plus the CPAN comparison passes 191 tests with no failures
and 13 explicit compiler/installed skips. TAP SHA256:
`6d8ca336dac078fc307918e41c4ac523d516de14d27bfb07b95f081be6670f48`.
Those skips do not establish fresh installed acceptance.
Full lint, checked-JavaScript type checking and all sixteen generated-reference
checks pass on the same frozen source files. The independent staged audit
checks all eighteen files, reverses all twelve transitions to their exact Git
predecessors and verifies that the 500-evidence/585-observation inventory,
earlier evidence files, production code, workflows and native probe are unchanged.

Earlier failing local records remain in `build/`: the initial ownership
reproduction, the two-failure broader regression, the eight-failure sweep,
the CPAN reproduction and the style-check failures. Successful producers were
not rerun for this assertion repair. Fresh hosted acceptance remains required.
