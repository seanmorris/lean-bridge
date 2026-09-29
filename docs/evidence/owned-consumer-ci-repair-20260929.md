# Owned consumer CI dependency repairs

[Downstream run 36528290507](https://github.com/seanmorris/lean-bridge/actions/runs/36528290507)
failed to load the owned npm compiler because Nix's component source filter omitted
`src/backends/native/owned-value-transfers.mjs`. Local import-closure inspection and
imports from a filtered copy reproduced the missing module. The manifest now
includes it. Tests inspect static and dynamic import declarations without treating
generated package-source strings as dependencies. Removing the module from the
filtered copy reproduces the failure.

Nix evaluation produced the repaired source in its store. All 147 declared files
match the checkout; all 115 source modules import from that store copy without
access to checkout dependencies. This check does not rebuild the Wasm runtime or
claim installed-package acceptance.

The same CI run passed all five owned WIT native tests, then exited with status
127 because `rg` was absent. The WIT job now installs `ripgrep` before using it to
check native, session and packaging logs. A regression test requires that setup
in the WIT job itself.

The repair receipt preserves earlier installed evidence through authenticated
source-history edits. It adds no type-support claims. Full downstream CI remains
a separate gate.
