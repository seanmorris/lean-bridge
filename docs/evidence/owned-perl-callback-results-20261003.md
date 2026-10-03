# Staged Perl callback-result ownership

This stage adds opt-in callback-local result anchors to the Perl ownership
projection. The selected callback argument remains the original owner of a
borrowed result, including empty containers and recursive descendants. Native
closures and host callbacks use checked whole-value owners at anchored argument
positions. Independent retains outlive the borrowed result's original owner.

The completed predecessor is JVM callback-result acceptance at commit
`95978558fed7e305833175f36a93a140ff84be9e`. Its receipt is
`owned-jvm-callback-results-20261003.json`, SHA-256
`ce3855e16ac23fed6c437def1c09a9c27c7c3ac54c2d3298141bad60c78d3310`.
The separate Perl source-history ledger authenticates the current changes against
that commit. It does not replace the JVM receipt or declare Perl accepted.

## Executed runtime coverage

Six real Lean-backed configurations passed: ordinary author configuration and
independently reviewed IR, each with native-only, host-callback, and combined
receiver/transfer capabilities. Each configuration ran on Perl 5.36.3 and 5.38.2,
with threaded and unthreaded builds: 24 interpreter executions in total.

Each interpreter executed 39 assertions for the native-only configuration,
60 for host callbacks, and 92 for the combined configuration. Across both source
paths and all four ABIs, the saved observations contain 1,528 assertions. Native
allocation, identity, managed-wrapper, owner, active-scope, and cleanup-status
counters are zero at the end of each execution.

The reports are the six `{ordinary,reviewed}-{no-host,host,combined}.json` files
under `build/owned-perl-callback-results/`. They retain the compiler inputs,
source identities, generated-source hashes, probe hash, and original process
stdout/stderr. These are direct runtime observations, not an independently
reconstructed or frozen Perl acceptance receipt.

Focused CLI packaging and installation, filtered Perl engine import closure,
checked-JavaScript disposition, and strict typechecking passed after registering
the new callback-argument module. No native package producer was run for that
inventory check. Existing generated APIs remain covered by explicit legacy-byte
regressions when callback-result anchors are absent.

## Still open

Installed CPAN callback packages, independent producer rebuilds, shared releases,
callback-specific lifetime and failure-injection acceptance, independent report
reconstruction, and frozen Perl acceptance remain open. This stage makes no new
installed-support claim and does not publish a registry package. Existing
type-surface support cells and completed predecessor receipts remain unchanged;
only authenticated current-source file hashes are refreshed.

## Reproduction

```sh
LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST=1 node --test \
  --test-name-pattern '^Perl callback-result owners execute real Lean' \
  tests/owned-perl-xs.test.mjs

node scripts/update-owned-perl-callback-history.mjs

node --test --test-name-pattern 'Perl callback source history|staged Perl source identities|frozen JVM CLI reports' \
  tests/owned-perl-xs.test.mjs
```

Run the updater only after the reviewed source edits have settled and the
authentic predecessor evidence files are available. It rejects unreviewed source
paths and records exact reverse spans; it never rewrites original runtime reports
or acceptance receipts.
