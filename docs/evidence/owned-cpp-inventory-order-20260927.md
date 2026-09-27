# C++ package inventory order repair

Core CI for `511f43f1b02a6bddb5517f47a497e8eda766a065` failed two
contract tests. Both npm source inventories placed the five new C++ ownership
modules after `primitives.mjs`, breaking their alphabetical ordering rule.
Both failures reproduced locally.

The repair sorts those entries without adding or removing package contents.
It updates the current type inventory's manifest hashes and preserves the
original C++ execution and integration receipts byte for byte. The companion
JSON records the complete source identities and reversible edits. Its verifier
leaves unknown source bytes unchanged and checks the original receipt hashes.

Verification:

- `node --test tests/source-inventory-order.test.mjs tests/cli-npm-package.test.mjs tests/owned-cpp-evidence.test.mjs`: 12 passed, no failures or skips.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run docs:reference`: passed.

No algorithm, native binding, supported type, or registry package changed.
