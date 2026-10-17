# Recursive checked records in Perl, 16 October 2026

The [authenticated archive](recursive-checked-record-perl-20261016/index.json) records four installed CPAN cells: ordinary Lean source and independently reviewed Binding IR for both the recursive-record and mutually recursive record/variant fixtures. Two independent author roots produced byte-identical component and runtime archives for every cell. The harness removed the author sources before installing those archives offline.

Each package ran on threaded and unthreaded Perl 5.36.3 and 5.38.2. Every Perl ABI used both a prebuilt XS package and a package compiled from the generated XS source. The unchanged caller ran before and after moving the complete installation, giving sixteen installed executions per cell.

The recursive fixture exercises a checked `Packet` whose optional tail has the same record type. The mutual fixture alternates a checked `Envelope`, an optional `Step`, and a variant branch that points back to the envelope. Both retain named aliases, ordered fields, active branches, checked `Nat` subtype constructors, `Fin 3` bounds, recursive arrays, and constructor-free results. Rejected values preserve the caller's complete input, exact depth and cycle failures remain distinct from Lean constructor failures, and valid calls after every rejection demonstrate recovery.

Every recursive execution completed 1,709 checks, including 144 expected Lean rejections, 79 host-shape rejections, 95 recovery calls, and 496 snapshots. Every mutual execution completed 1,734 checks, including 144 expected Lean rejections, 81 host-shape rejections, 97 recovery calls, and 502 snapshots.

The local runs used Lean 4.32.2 on Linux x64/glibc 2.36 with an explicit 2.36 package floor and 64-bit machine words. The [dedicated workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/recursive-checked-record-perl.yml) rebuilds all four cells on Ubuntu 24.04 and enforces the production glibc 2.38 floor.

The archive retains every non-binary producer record, package-set receipt and checksum sidecar, generated XS, CPAN manifest, installation receipt and trace, installed-file identity, caller result, TAP stream, verification record, and the exact producer/checker source closure. The original checker authenticated the prepared component and runtime CPAN archives; the repository archive records their byte lengths and SHA-256 identities without copying roughly 51 MiB of binary payload into each cell.

Lean erases `Prop` proof fields before native compilation. Installed packages execute the selected `Fin`, `Subtype`, and checked-record boundary validations. They do not run a proof-removal pass.

The immutable index digest is `ecd4bb3e3d6740d071ee8b4b927e25fcb26e5c78028c3fca141fb290e8386e84`. This evidence covers only the four named Perl cells. Other hosts, owned values, callbacks, open dependent shapes, and broader recursive forms require separate acceptance.
