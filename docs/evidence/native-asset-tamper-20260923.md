# Read-only native asset checks

All four Perl configurations in [CI run 35882567314](https://github.com/seanmorris/lean-bridge/actions/runs/35882567314)
failed when the documentation test tried to overwrite an installed native
library. MakeMaker had installed the file without owner-write permission.
Local tests running as root bypassed that restriction.

The test helper now grants owner-write permission to the private test file,
corrupts one byte and runs the rejection probe. Its `finally` block restores
both the original contents and permissions, including when the probe throws.
It rejects symlinks, directories and empty files before changing anything.

The regression test runs as a non-root owner. When its parent is root, the child
drops its group and user IDs before creating the fixture. It reproduces the old
`EACCES` error and checks read-only and read-executable files, successful probes
and failed probes: 21 assertions.

The full documentation test passed on Perl 5.36.3 and 5.38.2, each threaded and
unthreaded, through both ordinary source and reviewed contracts. All eight
installations returned the documented values and rejected three altered native
libraries before loading them: 24 rejections.

The [repair receipt](native-asset-tamper-20260923.json) retains the command logs,
source hashes and fresh installation reports. Both source paths reproduce the
original CPAN archives, package files, native libraries and public results.
The comparison excludes only MakeMaker's three installation bookkeeping files,
whose paths and dates vary. Their filenames, sizes and original hashes remain
recorded. The verifier reconstructs the two changed test helpers byte for byte
against the original receipts; it does not exempt production sources.

```sh
node --test tests/native-asset-tamper.test.mjs
LEAN_BRIDGE_PERL_GRAPH_DOCUMENTATION_TEST=1 \
  node --test --test-name-pattern='recursive Perl documentation builds' \
  tests/perl-graph-package.test.mjs
```
