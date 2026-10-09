# Installed Perl refinements

Perl 5.36.3 and 5.38.2, each threaded and unthreaded, pass installed CPAN checks for `Fin` inside `Array`, `List` and `Option`, and ordinary-source top-level checked `Subtype` values. All four Perl XS jobs passed in [Downstream run 37873560469](https://github.com/seanmorris/lean-bridge/actions/runs/37873560469), at revision `93c60a0487d0b2acc0b6d562cd72a3876738a666`.

| Selection | Source route | Checks per full consumer run, per configuration |
| --- | --- | --- |
| Container `Fin`, nested compositions and aliases | Ordinary source | 2,027 |
| Container `Fin`, nested compositions and aliases | Independently reviewed IR | 2,027 |
| Checked `Subtype` over `String`, `Nat`, `Int` and `ByteArray` | Ordinary source | 2,017 |
| Checked `UInt32` subtype and nested `Fin 0` containers | Ordinary source | 1,518 |

Each selection builds in two clean roots and compares the package archives. The harness removes author sources before offline installation, runs the complete consumer without compiler access, moves the installed tree, then reruns the unchanged consumer from the moved prefix. The old installation path must remain absent. Archive equality is checked within each configuration, not across Perl ABIs.

Container checks cover bounds wider than 64 bits, failing indexed paths, late arguments, unchanged caller data, recovery, and absent or empty `Fin 0` containers. The public Perl counter probe measures `mirrorAll` and `orDefault` source and adapter entries. Invalid calls enter neither; positive calls and recovery enter the expected functions. It does not measure every container export.

Subtype checks cover Unicode, embedded NUL, `2^100`, normalizing constructors, projected results, late checked arguments and repeated rejection/recovery. Public controls distinguish the `mix` validator, adapter and source, plus the `half` source. A failing `Fin` bound enters none; a rejected constructor enters the validator without entering the adapter or source. Direct typed-adapter checks belong to the separate C probe. The UInt32/nested-Fin-0 supplement does not measure dispatch counts.

The [immutable receipt](perl-relocated-hosted-20261009/receipt.json) records 16 original reports, 24 provenance/context files and 40 exact Git source snapshots. Its reader authenticates the [earlier archive](perl-refinements-hosted-20261009/receipt.json), then verifies that each new report preserves the earlier acceptance fields and package digests while adding installed-tree relocation and full-consumer repetition. Complete original model files, package-set receipts and binary archives are not retained here; their recorded digests are not independently reconstructed by the archive reader.

This acceptance covers container parameter/result positions and ordinary top-level Subtype. It does not add field, callback, product, `Except` or reviewed-Subtype support. Scalar `native-fin` reports from this run predate the later scalar-relocation fix and are excluded. The [type inventory](../type-surface.v1.json) keeps that scope separate from older scalar evidence.
