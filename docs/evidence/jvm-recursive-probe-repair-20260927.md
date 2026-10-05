# Recursive JVM probe loader repair

The JVM job in [run 36352610827](https://github.com/seanmorris/lean-bridge/actions/runs/36352610827/job/108714040411)
failed in the recursive Maven acceptance probe. GraphProbeSetup read the old
component-directory cache property and passed null to Path.of. The same failure
was reproduced locally from commit 578f04d with the pinned JDK 22.

The isolated probe now obtains its symbols from the authenticated loader's
lookup through a test-only accessor. It does not copy cache keys or accept a
directory override. The shipped Java/Kotlin API and native libraries are
unchanged. Fault injection still uses its separate, source-bound adapter.

The appended JSON record preserves the published JVM execution and integration
receipts. Exact whole-file hashes guard each predecessor restoration. Unknown
source changes remain visible to the existing evidence checks.

The fresh installed-package rerun passed with one test, no failures and no
skips. That test executes the ordinary-source and reviewed-IR recursive Maven
packages and their isolated failure probes. The twelve receipt-history tests
also passed. This repair changes no type-surface support claims.

Run the installed recursive acceptance with:

```sh
source scripts/env.sh
LEAN_BRIDGE_JVM_RECURSIVE_CALLABLE_TEST=1 node --test \
  --test-name-pattern='original recursive Maven' \
  tests/jvm-recursive-callables.test.mjs
```

The receipt-history tests are in tests/owned-jvm-package-evidence.test.mjs.
