# Required native PHP nominal Subtype checks

The native PHP job now requires all four ordinary/reviewed, full/result-only
Composer selections. Each selection reproduces its package, removes the
author and build roots, installs offline, and runs weak and strict callers
before and after relocation. The hosted runner selects an explicit glibc
2.38 package floor. PHP consumer source remains required at runtime.

The runner measures the selected PHP, Composer and loaded extension identities
before building. Those are observed versions from the job's installed tools,
not workflow-pinned apt package versions. A separate checker measures the
tools again, verifies the complete original ZIP and package receipt, and
checks every retained record against the selected producer, author route,
API mode and runtime. Missing, skipped or failing selections fail the job.

Complete and partial records are uploaded under names containing both the
commit and workflow attempt. Uploads never overwrite an earlier attempt.
The final PHP gate uses `always()` and requires all five acceptance outcomes.
All other jobs, existing PHP commands and the 240-minute job budget remain
unchanged.

## Local validation

The checker verified the four retained Composer handoffs from producer
`39f7f06e3db8f47b554ef039dc71c4bbc42ed98b`, using freshly inspected PHP 8.2.33
and Composer 2.5.5 on the original Linux x64/glibc 2.36 host. This check
authenticates the original records; it does not create new installed executions
or establish hosted 2.38 acceptance.

The focused suite passed 24 tests. It includes 164 failed/incomplete TAP
controls, 140 tool/record controls, 25 ZIP controls, 29 workflow mutations,
15 required-outcome cases, ten complete/failing shell scenarios and ten
stale-output refusals. Synthetic shell, tool and ZIP controls make no compiled
acceptance claim. The registered PHP suite passed 23 tests, historical-source
checks passed 11, and the affected archive suites passed 12. None were skipped.

The first focused attempt failed because its Node-based PHP stand-in used
an unrecognized `.2` extension. Renaming that synthetic executable to `.mjs`
resolved the failure. The original failing log remains in
`build/vo1466-php-ci-focused-r1-0.log`; the full replacement run passed.

The broader regression passed all 160 tests with no skips. Full ESLint,
checked JavaScript and all 16 generated reference pages passed. Validation
kept all 5,521 source, workflow and inventory fingerprints unchanged.
Actionlint passed with shellcheck disabled; separate Bash syntax checks passed
for the runner and all 243 workflow command blocks.

## Retained records

The [archive index](nominal-subtype-php-ci-20261013/index.json) records commands,
terminal results, source count and original file hashes. It retains the
focused TAP, four fresh handoff-verification reports and workflow validation.
Index SHA-256: `dba7139b51241e5bfe5da60fe2eab2aed7ebcca1ea851da838abba90d3ab7d03`.
The milestone audit checks all 32 staged files and preserves all 13,375
earlier evidence files.

The [exact source history](nominal-subtype-php-ci-source-history-20261013.json)
records eight reversible transitions and refreshes 117 existing source pins.
The inventory retains all 504 evidence entries and 587 observations with no
support-claim changes. This milestone changes no production adapter. Native
PHP support promotion and the corresponding consumer/author docs follow.
