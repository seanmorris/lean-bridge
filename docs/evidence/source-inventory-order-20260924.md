# Source inventory ordering

The development manifest and CLI manifest contain the same 441 source paths.
The PHP graph entries now follow the required lexical order. No package member,
script or other manifest field changed.

The [execution record](source-inventory-order-20260924.json) retains both original
file orders and their complete manifest hashes. The source-history verifier
reverses only a sorted permutation of the same unique paths, then checks the
original hash. Later additive registrations can reverse through that step.

The verifier integration is also exactly reversible. The original PHP-Wasm
package/loading receipts and native-tamper receipt remain byte-identical.
Tests reject added or missing paths, duplicates, unsorted replacements, changed
scripts and unrelated source edits.

All five CLI package tests pass, including installation of the original tarball
locally, globally and through npm exec without the checkout or install scripts.
This record closes the inventory-ordering failure; production-source regressions
and final cross-language acceptance remain separate checks.
