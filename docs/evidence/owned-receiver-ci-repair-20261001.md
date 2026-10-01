# Receiver CI tooling and documentation checks

Perl receiver job 110539000804 in downstream run 36912566757 passed all sixteen
tests, then exited 127 because `rg` was absent. The job now installs `ripgrep`
before running its required TAP summary checks. The workflow contract rejects
removing the dependency, as well as skipped tests or missing reports.

The native PHP repository suite also found a stale documentation assertion that
required receiver-anchored lifetimes to remain unsupported. Native PHP now
supports them. The test checks the methods/properties section, preserves the
callback-result lifetime limitation, and keeps PHP-Wasm's pending status explicit.

Both failures reproduced locally before correction. This repair changes CI and
documentation checks, not generated libraries, runtime code or installed support
claims. The accompanying source ledger preserves the committed native PHP and
Perl acceptance receipts without rewriting their archive identities.
