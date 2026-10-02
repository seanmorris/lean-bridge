# Historical fixture reader repair

VO task 1219. Baseline: `a53368d1bb94f7651cdd571365e8e7a5e6212cd2`.

The WIT receiver milestone added exact `expectedChecks` support to the shared
copied-fixture installer. Its immutable receipt records that source change.
Eighteen older alias, variant and collection checks still compared the installer
directly with its previous hash. They did not follow that recorded transition.

Two WIT workflow negative tests also changed the first matching dependency list
in the entire workflow. After adding the receiver job, that list belonged to a
different job, so the required `wasi-consumer` dependencies remained intact.

## Repair

The [delta ledger](copied-fixture-reader-repair-20261002.json) records 25 exact
reader, registration and source-index updates. The
[history helper](../../tests/helpers/copied-fixture-source-history.mjs) pins its
hash, reverses only those complete before/after source identities, and then
replays the original WIT installer edit. Unknown source changes remain visible
to the original receipt checks. The latest JVM/WIT history chain also includes
these reader updates.

Both workflow negative tests now mutate the required job. They check that the
mutation occurred and that removing a dependency from an unrelated job does not
invalidate `wasi-consumer`.

The repair does not rewrite any historical acceptance receipt, bypass a source
hash check, or promote a support-matrix cell. The type-surface index refreshes
115 current source hashes without changing its support claims.

## Verification

The final affected-reader and registration run passed 65 tests. After correcting
the second workflow mutation, the final history, JVM, WIT and workflow checks
passed all 22 tests without skips. The earlier predecessor run passed 25. The
new history tests reject unknown source bytes, altered transitions, forged
ancestors and support-claim changes. Full lint, checked JavaScript and all 103
documentation checks pass.

The broad local run completed 3,601 tests: 2,965 passed, 634 were skipped, and
two failed. One failure was the corrected WIT workflow mutation. The other was
a C++ compiler deadline while two full suites overlapped. Its isolated rerun
passed both tests, including 1,216 normal and 1,216 sanitized runtime checks.
That broad run is not an all-green acceptance result; CI must verify the final
commit.

Focused commands:

```sh
node --test tests/copied-fixture-source-history.test.mjs
node --test tests/owned-consumer-ci-repair.test.mjs tests/wit-owned-package-evidence.test.mjs
node --test tests/cpp-copied-graph-conversions.test.mjs
npm run lint
npm run typecheck
npm run test:contracts
```
