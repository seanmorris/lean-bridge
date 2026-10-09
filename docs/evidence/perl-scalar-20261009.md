# Perl scalar Fin acceptance

The installed scalar `Fin` checks pass on Perl 5.36.3 and 5.38.2, each threaded and unthreaded. Each configuration runs both an ordinary-source package and a separately reviewed API package at [revision 046ced0](https://github.com/seanmorris/lean-bridge/commit/046ced089cd007d10ce91b66a69c461321c808ca), in [the hosted consumer run](https://github.com/seanmorris/lean-bridge/actions/runs/37897964965).

Each package passes 2,024 public checks, then runs the unchanged consumer again after moving its installation. Two independent author roots produce identical package archives. The tests remove author sources before installing offline and running without compiler access.

The fixture covers scalar parameters and results with bounds 0, 1, 10, 300 and 2^70, transparent aliases, result-only `Fin`, exact bound errors, unchanged caller values and 1,000 rejection/recovery cycles. Perl callers use `Math::BigInt`; negative values retain the `Nat` conversion error.

The relocated process also runs four source-entry controls:

| Control | `mirror` entries | `impossible` entries | `label` entries |
| --- | ---: | ---: | ---: |
| Valid mirror call | 1 | 0 | 0 |
| Invalid calls only | 0 | 0 | 0 |
| Valid label call | 0 | 0 | 1 |
| Rejection followed by valid mirror | 1 | 0 | 0 |

These counters measure the three named Lean functions, not every export or typed-adapter entry. [Container Fin and Subtype checks](perl-refinements-20261009.md) retain their separate evidence.

The [archive receipt](perl-scalar-hosted-20261009/receipt.json) records all four jobs, original logs, GitHub artifact ZIPs, both reports per configuration and selected producer-source snapshots. Its checker authenticates ZIP membership and refuses missing configurations, changed reports, skipped tests and mismatched source counters. Package binaries and complete build documents are not included; their reported digests remain recorded identities. The packages specify a glibc 2.38 floor, but these runs do not establish execution on a minimum-libc machine.
