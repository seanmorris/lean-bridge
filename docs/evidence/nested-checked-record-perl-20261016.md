# Nested checked records in Perl, 16 October 2026

The [authenticated archive](nested-checked-record-perl-20261016/index.json) records four installed CPAN selections: ordinary Lean source and independently reviewed Binding IR, each as a full API and a standalone result-only API. Two independent author roots produced byte-identical component and runtime archives for each selection. The harness removed the author sources before installing those archives offline.

Each package ran on threaded and unthreaded Perl 5.36.3 and 5.38.2. Every Perl ABI used both a prebuilt XS package and a package compiled from the generated XS source. The unchanged caller ran before and after moving the complete installation, giving sixteen installed executions per selection.

The full APIs pass a proof-free generated `Packet` class through direct and repeated parameters, arrays, lists, options, products, both `Except` branches, an enclosing `Holder` field, and an active `Choice::Packet` field. `Packet` contains a `Fin 10` digit and a checked `Nat` subtype word. Generated adapters invoke the selected constructors at every present input site. Rejected graphs preserve the caller's complete input, and later valid calls demonstrate recovery. Lean-produced arrays and optional results expose payloads without proof fields or input-constructor metadata.

Each full installed execution completed 4,762 checks, including 524 expected Lean rejections, four host-shape rejections, 528 recovery calls, and 1,060 caller snapshots. Each result-only execution completed 1,571 checks, one host-shape rejection, one recovery call, and 520 snapshots. The result-only packages expose no checked-input constructor metadata.

The local runs used Lean 4.32.2 on Linux x64/glibc 2.36 with an explicit 2.36 package floor and 64-bit machine words. The [dedicated workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/nested-checked-record-perl.yml) rebuilds all four selections on Ubuntu 24.04 and enforces the production glibc 2.38 floor.

The archive retains the generated XS, CPAN manifests, installation receipts and traces, installed-file identities, caller results, TAP streams, verification records, and the exact producer/checker source closure. It records prepared CPAN archive and installed native-library identities without copying those binary artifacts. The archive contains 986 authenticated files under index digest `3369153c41485db63e24f0267d0bb13e8cdcb849b869a04af52c9878422a152f`.

Lean erases `Prop` proof fields before native compilation. Installed runtime work consists of the explicitly selected `Fin`, `Subtype`, and checked-record boundary validations, not proof removal.

This evidence covers the exact acyclic `Packet`, `Holder`, `Choice`, and copied-container forms in the archive. Generic, recursive and inherited checked records, other indices, open dependent and zero-payload records, callbacks, owned positions, and other platforms require separate acceptance.
