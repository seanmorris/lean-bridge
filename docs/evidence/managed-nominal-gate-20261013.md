# Managed CI nominal JVM gate test repair

The core quality run [38428604129](https://github.com/seanmorris/lean-bridge/actions/runs/38428604129) failed two managed CI isolation tests. The workflow already required the nominal JVM result. The test helper omitted that result from its simulated outcomes, and one mutation still expected the older final-gate expression.

This repair adds explicitly configured required steps to the isolation helper and registers `nominal_jvm` for the JVM profile. The helper checks routing, step order, missing outcomes, failure, cancellation, skipping, and `continue-on-error`. It rejects undeclared profiles, duplicate step IDs, and IDs that shadow existing required steps. Current checks exercise 30 outcome cases. The historical workflow still exercises its original 27 cases.

The production adapters, consumer workflow, and support inventory are unchanged. This repair makes no new installed-consumer support claim.

## Retained records

- Predecessor commit: `968c1e9877c6cffe0667b81b4ea71bf18b46fd75`.
- [Original reproduction](managed-nominal-gate-20261013/reproduction.tap): one passing test and two failures, with no skips. Its [launch record](managed-nominal-gate-20261013/reproduction.json) identifies the original inputs.
- [Focused validation](managed-nominal-gate-20261013/focused.tap): 11 passing tests, no failures or skips.
- [Archive index](managed-nominal-gate-20261013/index.json): original file sizes and SHA-256 digests, validation commands, terminal results, and source-fingerprint count. Index SHA-256: `fbc6b305559dd69d8dad87515d0b2a89986c60f5b4cb62436a8408785fc01384`.
- [Exact source history](managed-nominal-gate-source-history-20261013.json): four reversible source transitions. Unknown edits remain visible to the earlier evidence checkers.

## Validation

The targeted history and workflow checks passed. The three affected archive suites passed all 12 tests. The broader regression passed all 160 tests, covering the support inventory, documentation, test profiles, checked JavaScript, and PHP/JVM evidence controls. No tests were skipped in these runs.

Full ESLint, checked JavaScript, and all 16 generated reference pages passed. Every validation phase checked the same 5,506 source, workflow, and inventory fingerprints before and after execution.

The first archive validation attempt was stopped after memory use grew substantially. A second attempt stopped at the host-load guard before starting tests. Their original logs and resource records remain under `build/vo1220-managed-gate-archives-r1*` and `build/vo1220-managed-gate-archives-r2*`; neither attempt counts as a passing run. The successful third attempt ran the suites serially on one CPU with a 3 GiB JavaScript heap limit.
