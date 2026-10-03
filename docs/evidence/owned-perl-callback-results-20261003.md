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
stdout/stderr. Each process reports its actual Perl version and threading mode.
The evidence verifier reconstructs the six generated C/XS configurations from
the pinned compiler inputs and rejects 253 altered report or matrix claims.
These direct runtime observations are not a frozen Perl acceptance receipt.

Focused CLI packaging and installation, filtered Perl engine import closure,
checked-JavaScript disposition, and strict typechecking passed after registering
the new callback-argument module. No native package producer was run for that
inventory check. Existing generated APIs remain covered by explicit legacy-byte
regressions when callback-result anchors are absent.

## Failure injection

Ordinary and reviewed combined configurations passed allocator, managed
exception, and native allocation sweeps on all four Perl variants. The probes
exercise raw host replies, whole-value replies, and whole-value recovery through
consuming receivers. Every case includes failures before and after the native
ownership transfer, followed by a restored control run.

Each interpreter completed 12,015 assertions over 1,294 attempts and kept 1,273
errors alive through cleanup. The eight executions total 96,120 assertions.
Independent retains remained usable; original aliases expired only after the
recorded transfer. All six final cleanup counters returned to zero.

The two reports under `build/owned-perl-callback-result-faults/` retain every
attempt and its original process output. Their verifier reconstructs the native
and XS sources, checks every handoff and restored control, and rejects 106 forged
reports, including coordinated changes to parsed observations and raw output.
It requires each restored control immediately after its fault sweep and checks
the recorded allocation, active-scope, and cleanup-status counters.

## Process lifetimes and compiled negative controls

Both source paths passed process/reentry and reentrant-shutdown probes on all
four Perl variants: 16 subprocesses and 520 assertions. Forked processes and
cloned interpreters reject six public entry points while the creator remains
usable. The probes also cover nested raw and whole-value callbacks, closing an
original owner during an active call, shutdown during a callback, and deferred
native cleanup. Every execution finishes with six zero counters.

The lifetime verifier derives exact failure locations from the probe and
generated adapter. It checks the interpreter fingerprint, all observed events,
and the complete source/scenario matrix, rejecting 239 coordinated alterations.

Four deliberately broken XS adapters compiled on both source paths and all four
Perl variants. The 32 executions fail their named semantic checks for a wrong
callback owner, expired empty values, an escaped callback frame, or a missing
whole-reply conversion. All 48 original-code controls pass 92 assertions. The
verifier reconstructs each source substitution and rejects 68 false claims;
compilation failures and crashes cannot stand in for semantic failures.

## CPAN contract checks

The producer generates callback-specific owned-v5 policies and forwards the
capability through native and multi-profile builds. Callback-only packages do
not require host callbacks, transfers, export anchors, or receiver methods.
The package verifier reconstructs the compiler-derived model and generated
sources. It rejects downgraded or stripped summaries using independent binding
IR and native receipt witnesses.

The v5 component installer extends the existing builder with a separate
validator. Earlier components and the shared runtime retain the original
`Build.pm` bytes. Prepared-package verification also requires the exact generated
installer, even if someone rewrites its mutable file inventory.

Four installer tests passed with no skips on all four pinned Perl ABIs. They
accepted 16 isolated JSON contracts and 32 compiler-derived contracts, rejected
768 altered contracts, and confirmed that 32 unchanged legacy readers reject
v5. The compiler-derived fixtures use synthetic library bytes and never load
native code. Three JavaScript package tests reconstruct eight capability/source
configurations, reject 48 altered policies, and reject two rehashed installer
substitutions. These tests do not claim installed CPAN execution.

The standalone CLI inventory, offline CLI installation, filtered Perl engine
closure, strict typechecking, and scoped lint pass with the new template and
renderer included. The callback contract wrapper belongs to the mandatory core
test profile; the four-ABI installer cases require the opt-in variable below.

## Installed public consumer

One ordinary combined package set passed source-free, prebuilt-only installation
on all four Perl variants. After removing the author, handoff, and build tools,
the runner relocated each installation and ran its public consumer twice.
Each process passed 79 assertions, for 632 assertions across eight fresh
processes. The runner verifies the installed XS image hashes against their
architecture-specific receipts.

The consumer exercises native and host callbacks, callback order, whole replies
and recovery, transitive expiry, independent retains, and consuming receiver
preflight. It uses no private cleanup counters. The saved report binds the
original CLI, package receipts, and final consumer executions. This is a
single-producer smoke test; independent rebuilds and XS compilation during
consumer installation remain separate requirements.

## Complete CPAN installation matrix

Ordinary and reviewed source paths each passed two independent producer builds.
Their package sets, manifests, and archive bytes match within each source path.
Archive reassembly also reproduces the original bytes.

The resulting packages passed 16 installations: both source paths, all four Perl
ABIs, and both prebuilt-only and build-xs modes. After removing the producer,
source, tools, and handoff, each relocated installation ran its public consumer
twice. Those 32 processes passed 2,528 assertions. The reports retain the actual
installer commands, architecture receipts, XS hashes, and original outputs.

Another 96 cold and warm checks reject altered installed XS, GMP, and component
libraries. These public installed-package checks do not measure private native
allocation counters. The original reports are
`{ordinary,reviewed}-combined-package.json` under
`build/owned-perl-callback-results/`.

## Address and undefined-behavior checks

Both source paths passed on all four Perl ABIs with the generated C adapter,
native broker, XS, Lean-emitted Owned/Carriers/Witness C, and callback C rebuilt
with ASan and UBSan. Forty positive executions passed with empty stderr. All 32
intentional native and XS address/undefined-behavior defects triggered their
named detector sites. The probes executed 97,376 Perl assertions and ended with
six zero cleanup counters.

Prebuilt Perl, its standard XS modules, the Lean runtime, and GMP were not
instrumented. These address/undefined-behavior runs disable leak detection.
The separate strict LSan matrix is not clean: 55 executions report leaks, and
one reports a tracer failure that makes the detector unavailable. Thirty-nine
cold or exercised runs report the same 128 bytes in 12 Lean/GMP allocations;
16 intentional leak controls add 73 bytes in one allocation. Setting
`PERL_DESTRUCT_LEVEL=2` removes interpreter arena-exit noise without suppressions.
The final reports and earlier failed attempts remain archived separately.

## Still open

Shared releases, installed/sanitizer report reconstruction, and frozen Perl
acceptance remain open. This stage makes no new installed-support claim and
does not publish a registry package. Existing
type-surface support cells and completed predecessor receipts remain unchanged;
only authenticated current-source file hashes are refreshed.

## Reproduction

```sh
LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST=1 node --test \
  --test-name-pattern '^Perl callback-result owners execute real Lean' \
  tests/owned-perl-xs.test.mjs

LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST=1 node --test \
  tests/owned-perl-callback-result-contract.test.mjs

LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_EVIDENCE_TEST=1 node --test \
  tests/helpers/owned-perl-callback-result-runtime-evidence-tests.mjs

LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST=1 node --test \
  tests/helpers/owned-perl-callback-result-fault-tests.mjs

LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST=1 node --test \
  tests/helpers/owned-perl-callback-result-lifetime-tests.mjs

LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_MUTANT_TEST=1 node --test \
  tests/helpers/owned-perl-callback-result-mutant-tests.mjs

LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_PACKAGE_TEST=1 node --test \
  tests/helpers/owned-perl-callback-result-installed-smoke.mjs

LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_PACKAGE_TEST=1 node --test \
  tests/helpers/owned-perl-callback-result-packaging-tests.mjs

LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST=1 node --test \
  tests/helpers/owned-perl-callback-result-sanitizer-tests.mjs

node scripts/update-owned-perl-callback-history.mjs

node --test --test-name-pattern 'Perl callback source history|staged Perl source identities|frozen JVM CLI reports' \
  tests/owned-perl-xs.test.mjs
```

Run the updater only after the reviewed source edits have settled and the
authentic predecessor evidence files are available. It rejects unreviewed source
paths and records exact reverse spans; it never rewrites original runtime reports
or acceptance receipts.
