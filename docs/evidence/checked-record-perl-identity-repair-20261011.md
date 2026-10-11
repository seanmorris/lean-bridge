# Perl checked-record runtime identity repair, 11 October 2026

The installed harness compared two different identities. A native package-set
receipt names the native runtime. A CPAN manifest names both that native runtime
and the Perl binding built around it. `writeNativePackageSet` already checks this
relationship in `src/release/package-set-assembly.mjs`.

The harness now compares `manifest.nativeRuntimeIdentity` with the package-set
entry and separately checks the runtime/component CPAN binding identity. It also
checks distribution names, package versions, the exact runtime dependency, and
the manifest hashes of `runtime.json` and `binding.json`. The report reader applies
the same checks. Thirty-eight negative controls reject mixed identities,
dependencies, coordinates and payload hashes. Production packaging is unchanged.

## Original failure and diagnostic

Frozen producer `64a015549e71af6cec1d9d8e8ad947466b6842a9` completed both author
builds with all four Perl ABIs, then failed before the first consumer execution.
Its original TAP, start/end records and queue log remain in the
[36-file archive](checked-record-perl-identity-repair-20261011/index.json).
Index SHA-256: `a8113b27f2e921938cbd9552bbd9f7083e08a214cc071efc20cffc5b084f8424`.

The repaired draft helper consumed those retained archives on Perl 5.36.3
threaded. Prebuilt-only and build-xs each passed 9,024 checks, including installed
byte stability, whole-tree relocation and replay. The archive retains both
diagnostic reports, original stdout, manifests, install receipts, traces, file
inventories and the exact helper snapshots used. This diagnostic does not replace
the complete frozen four-route, four-interpreter installed acceptance.

The four-root regression passed 101 tests with zero failures and 36 explicit
compiler/installed gates. Type checking and all 16 generated reference pages
passed. The existing source-history audit still authenticates 3,893 distinct
source pins and preserves all 6,502 older evidence files, 436 evidence entries
and 551 observations. This repair promotes no support cells.
