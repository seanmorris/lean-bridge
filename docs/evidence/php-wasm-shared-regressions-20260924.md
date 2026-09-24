# PHP-Wasm shared-source regressions

The [execution record](php-wasm-shared-regressions-20260924.json) binds the six
wasm32/recursive-admission source changes to fresh installed acyclic tests and
comparisons with the original implementation. Earlier JSON receipts remain
unchanged. This does not promote the final cross-language acceptance inventory.

The ordinary-package gate compiles two independent 46-export Lean APIs and
rebuilds them from relocated inputs. In an isolated test tree, it restores the
six original source files from checksummed execution records. Both the original
and current readers accept each new compiled component. Both packagers then
process those same components and the same fresh shared runtime.

Each package comparison covers 100 files. The two Composer ZIPs remain
byte-identical. The npm payload changes are limited to five files: the runtime
host, its identity receipt, its descriptor and manifest, and the component's
runtime dependency. The runtime identity changes because it includes the host
and packager source hashes. All other non-archive payloads remain identical.

The same test installs the current archives and runs its original Node and
Chromium checks, including weak/strict callers, startup/lazy loading, shared
initialization, callback failures, twenty further requests, failed-loading
recovery and the documented consumer examples. All five tests pass with no
skips. The fresh run took 251.9 seconds.

The restored and current native graph generators also produce identical output
for three contracts, each with and without a runtime initializer. These six
hashes match the original native artifacts recorded before wasm32 support.

The historical-source verifier accepts only these six measured production
changes. Its own test integrations reconstruct their original sources exactly.
Negative tests reject omitted sources, missing package comparisons, changed
Composer archives, modified PHP payloads and missing browser observations.
CI requires and retains the fresh comparison report.

The first expanded run found a missing license file in the isolated old-source
tree. The corrected fixture copies the license and notices before packaging;
the complete gate then passed. No production checks were relaxed.
