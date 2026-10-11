# Structural checked-constructor selections

This change implements the selection-tree prerequisite from VO #1444, comment
2025. Nested Subtype execution remains unimplemented. The compiler, ABI and
native boundary admission checks are unchanged; accepting this configuration
syntax does not enable a transport or promote a type-inventory cell.

## Representation

The existing scalar `{ "constructor": "Library.checked" }` selection is unchanged.
Structural selections use `kind` and ordered `arguments`:

```json
{
  "kind": "tuple",
  "arguments": [
    { "kind": "array", "arguments": [{ "constructor": "Library.normalize" }] },
    null
  ]
}
```

`array`, `list` and `option` have one child; `tuple` and `result` have two.
Result children follow transport order, `[success, error]`, not Lean's `Except`
type-argument order. A null branch selects no author constructor. Compiler-owned
Fin bounds remain in their original refinement tree, including Fin-only
branches alongside a Subtype.

The configuration reader rejects unknown fields, malformed constructor names,
wrong arity, sparse children, empty subtrees, more than 32 edges or more than
4,096 visited nodes. It counts repeated subtrees each time they are visited and
terminates on cycles. The schema describes the same structural forms; depth and
node budgets are enforced by the reader. A separate derivation function prepares
constructor choices from validated refinement trees without modifying those
trees. Reviewed-source admission does not use it yet.

Both CLI source lists and both Nix engine boundaries include the new module.
Tests run through the existing export-configuration contract root. They cover
all five structural constructors, null Fin-only branches, distinct constructor
choices, branch ordering, malformed later branches, depth and node limits, and
unchanged input trees. An explicit negative control confirms that the runtime
contract still refuses an erased array without compiler-checked constraints.

## Evidence preservation

Ten exact transitions refresh 87 source pins without changing the 440 evidence
claims or 555 observations. The independent Git audit checks all 7,614 earlier
evidence files byte-for-byte. Ledger SHA-256:
`b2334ecbb9701c2726aa1d89026cc027a313cc7946c76d0e94c7cdb1dca245d1`.

The first packaging regression found an unsorted entry in the explicit source
allowlist. The corrected lists retain their existing alphabetical order. Its
failed TAP remains at `build/vo1444-structural-selector-integration-r1.tap`.

## Verification

The final nine-root regression passed 117 tests with zero failures and two
explicitly gated installed tests skipped. It includes configuration/schema
checks, the CLI package and engine boundaries, source-history authentication,
the type inventory and existing native Subtype/refinement refusal tests.
No nested installed acceptance is claimed. Targeted ESLint, checked JavaScript
and all 16 generated reference checks pass.

Regression TAP: `build/vo1444-structural-selector-final-r2.tap`, SHA-256
`1e04070f439dbefed836afb069ace2dcfd5bb0ac1aca803c701ad2b6e9fe810d`.
The complete documentation suite also passes all 133 tests without failures or
skips. Audit: `build/vo1444-structural-selector-audit-r2.json`, SHA-256
`9d520a2f1d568da0a391279ed8fbdc7b14c07eb54cdba91ad07b0c3616bebb42`.

## Remaining implementation

Fresh Lean extraction must carry the selection tree through structural edges
and aliases, checking each constructor against the exact source Subtype. ABI
and metadata validators must distinguish structural Subtypes from nominal,
callback and owned positions. Native adapters must retain every raw structural
and Fin check before constructor execution, preserve normalized values, and
report the rejected parameter and selected constructor accurately. Ordinary
and reviewed installed acceptance, browser/PHP-Wasm/native/Perl coverage, public
documentation and recurring CI remain required before support promotion.
