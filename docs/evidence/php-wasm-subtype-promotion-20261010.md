# PHP-Wasm Subtype support-table update

The [installed archive](php-wasm-subtype-installed-20261010.md) supports four
new PHP-Wasm cells: top-level Subtype parameters and results through ordinary
source and independently reviewed Binding IR. Both routes ran twelve installed
configurations with 2,024 public checks each. The archive's producer remains
`b7706ed7be1b24c0592fa4e3f7eccbd21ba7eb5d`.

The inventory adds two evidence entries and two observations. Its 405 older
evidence entries retain their claims; its 507 older observations remain unchanged.
The update authenticates the original archive before selecting either route.
Missing, duplicated, reordered or weakened selections fail the promotion checks.

The PHP consumer guide and Lean author guide now describe the primitive host
values, checked constructors, normalization, rejection and proof-backed results.
Generated PHP-Wasm package READMEs retain the supported Fin container and field
cases and no longer exclude all reviewed Fin packages. Subtype packages use the
heading "Checked refinements"; Fin-only packages keep "Bounded integers".

Constructor, adapter and source entry counts remain unmeasured. This update does
not establish hosted execution, other browser engines, nested or nominal Subtype,
refined callbacks, or graph/owned refinement transports. Tasks #1443 and #1220
remain open.

## Validation

The final focused run passed 19 tests with no failures or skips. Its local TAP,
`build/vo1443-subtype-promotion-focused-r2.tap`, has SHA-256
`9d0e791a78a27f60819bed57e4ba20311447f7bc1028fc5833a1d07bdc1d3e39`.
Documentation and inventory checks passed 114/0/0, with TAP SHA-256
`0b56a6662971cbe64998e84ed9511e2110a758249ba22f98ba9b8600e925f9cc`.
The five-root integration run passed 87 tests and skipped fourteen explicitly
gated compiler/installed tests; none failed. Its TAP SHA-256 is
`b9fdee1bee618fb87dcc4c04bb14e8253b0a4e3f51ffd2cc3759d2ec70af4fea`.
Full lint, checked JavaScript and all sixteen generated-reference checks passed.

The first documentation run exposed two stale inventory expectations. Updating
the exact PHP-Wasm route/position expectations resolved both. Three lint style
errors were corrected before the successful full lint run. The original failed
logs remain under `build/vo1443-subtype-promotion-`.

The [source-history ledger](php-wasm-subtype-promotion-source-history-20261010.json)
records eleven transitions from `1d95f243e3998082405267d7d745ed76367219ca`.
Its SHA-256 is
`e15bcc8b90174b20163bc9e04ae46eb6da68887998d313db2ad41e3aa2ae7af0`.
An independent Git comparison verified all predecessors, 76 current-source hash
updates, unchanged older claims, and unchanged original archive bytes.
The audit log SHA-256 is
`4f583306ff5d536c5bada5d4278bfd8496aed47a0efc2a94968971132733020e`.
