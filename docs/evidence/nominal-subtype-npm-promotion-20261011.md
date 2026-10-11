# Nominal Subtype Node support and documentation

This milestone records the [four installed npm selections](nominal-subtype-npm-acceptance-20261011.md)
in the support inventory and current documentation. It supersedes that archive
checkpoint's pending docs/inventory update. It does not rerun or rewrite the
original package executions.

## Exact support change

The inventory adds four evidence references, one for each ordinary/reviewed and
full/result-only selection at producer
`fab6d1b1c054a7a818bf70e4be84c80d7e8ec5c7`. Each reference authenticates the
original archive, selected Git source snapshots, compiler records, receipts,
runtime observation and source-free relocated execution.

Only `node-javascript` and `node-typescript` change:

- Eight existing Subtype input/result cells retain their earlier evidence and
  gain the nominal and constructor-free result checks.
- Four field cells gain installed acceptance for the tested Nat Subtype fields
  in acyclic copied records and tagged variants, on both source routes.
- Browser, React, worker, native, PHP-Wasm and callback cells remain unchanged.

The inventory now contains 476 evidence entries and 573 observations. The new
scope names Node 22.23.2/Linux x64, strict TypeScript, Nat payloads, aliases and
mixed Fin checks. It does not establish other primitive bases in nominal fields,
another runtime floor, constructor/source entry counts, owned or recursive
Subtypes, or general dependent/generic combinations.

The two author guides, JavaScript/TypeScript guide and generated type reference
now describe that scope. The generated JavaScript table separates Node's field
acceptance from the still-pending browser field cells. Native examples retain
their compiler-stage status.

## Verification

The focused regression passed 50 tests with six explicit build gates skipped.
The broader component, author, source-history, inventory, generated-table and
test-registration regression passed 174 tests, with zero failures and six
skips: two existing Lean/compiler example gates and the four separately executed
installed npm gates. Log: `build/vo1444-nominal-npm-promotion-regression-r1.tap`,
SHA-256 `a9aafcede2c38d9986d7f2c6e0552926e73d4fd365ea3a1df8de62a97c9d3b6d`.

A separate structural-guide check found a whitespace-sensitive assertion after
the prose was rewrapped. The assertion now normalizes whitespace before checking
the same required wording. The final documentation/history regression passed
all twelve tests with no skips. Log:
`build/vo1444-nominal-npm-promotion-doc-history-r1.tap`, SHA-256
`7b417378a1d90f3d64a020063381487c3da0809e88ee53a84bb0345edb3ebeb0`.
All sixteen generated references, checked JavaScript types, targeted ESLint and
diff checks also passed. Local checks ran serially at low CPU and I/O priority.

The promotion tests reject missing/corrupted originals, substituted runtime or
scope, reordered/incomplete references, duplicate promotion and overlapping
observations. They compare every inventory cell and require exactly the twelve
Node changes above. Earlier support claims remain intact.

The source-history ledger records thirteen exact transitions from
`d5aedc154ed94073c85c0087c466b426c7991d56` and refreshes 123 current-source pins.
Its SHA-256 is
`2a231211f543212454833df9e1aceff548a3ba4a42882592c49df6b915c69847`.
All 10,196 earlier evidence files remain unchanged. No production compiler source
or earlier package receipt changes.

Required recurring npm execution, the remaining nominal consumers and the
original callback/owned/recursive/generic requirements remain open in VO #1444.
