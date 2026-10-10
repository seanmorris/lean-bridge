# Diagnostic archive-reader CI repair

Core quality run [38028233240](https://github.com/seanmorris/lean-bridge/actions/runs/38028233240) failed 12 tests at `969abdfbb3b5c94b6d0944beb84f97d7540f0395`. All 12 failures reproduced locally at `4007e0d1926a0a2206e8b49c26f82b474aca0c0f` before this repair.

Several historical report tests compared recorded consumer and probe digests directly with consumers changed by the native Fin diagnostic update. The Array and Perl inventory tests also read current sources while checking earlier milestone inventories.

The archive readers now reconstruct authenticated predecessors. The edge archive checks every recorded producer source against its archived bytes before composing historical consumers. Binary artifacts remain bytes throughout inventory checks.

The live CI report checker still requires current probe identities and exact indexed diagnostic rows. Its contract tests validate the original seven-host reports with their historical archive validator, confirm that the live checker refuses those stale reports, and use explicitly synthetic in-memory fixtures to exercise the current report format. Those fixtures are not installed-package acceptance evidence. Each mutation starts with a passing format fixture.

The new [source-history ledger](native-fin-diagnostic-ci-source-history-20261010.json) records 12 exact transitions and refreshes 12 source pins. No original report, prior ledger, support state, or observed coverage changes.

## Local verification

The regression covering all eight failing roots, native Fin records, diagnostic history, Nix source filtering, and the type-surface inventory passed 152 tests with zero failures in 115.690 seconds. Four opt-in installed/compiler tests were skipped; this run does not replace their acceptance gates. Repository lint and checked JavaScript also passed.

```sh
node --test --test-concurrency=1 \
  tests/helpers/python-refinement-evidence-tests.mjs \
  tests/fin-container-edge-evidence.test.mjs \
  tests/fin-container-entry-ci.test.mjs \
  tests/helpers/inherited-record-evidence-tests.mjs \
  tests/helpers/inherited-record-promotion-tests.mjs \
  tests/generic-record-array-rollout-history.test.mjs \
  tests/helpers/reviewed-fin-host-evidence-tests.mjs \
  tests/perl-scalar-promotion.test.mjs \
  tests/native-fin-records.test.mjs \
  tests/type-surface.test.mjs
```

Local reproduction TAP SHA-256: `c2e3753ae21ce74308c6e2f82d4de2c49366e4d6197161b3ed37328aed3d4ef4`.

Local passing regression TAP SHA-256: `60afb81b652f899a5e0543d806239478dd70b2ac5d2f65b8d1d3c83669ecde01`.

The TAP originals remain under `/app/build/vo1220-core-history-repro-r1.tap` and `/app/build/vo1220-core-history-fix-r3.tap`; their hashes identify local verification, not retained CI artifacts or hosted acceptance.
