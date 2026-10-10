# Reviewed C/C++ and npm package records

The reviewed C/C++ and npm installed producers now retain selected original
author, compiler, receipt and caller files before deleting temporary builds.
An independent CI checker can use these files to authenticate a fresh report.
The checker and workflow gates are still pending.

Both producers create a fresh records directory before building. They refuse
an existing directory without replacing its contents. Partial records survive
a later failure. Each independent build retains its Lean source, export
configuration and independently authored review.

C/C++ also retains each original native model and package-set receipt, plus
the exact installed C and C++ callers. The installer now requires exactly
2,033 C checks and 2,026 C++ checks. npm retains its Binding IR, compiler
adapter plan, component build plan, bundle manifest, provenance, runtime
requirement and package receipt. It captures the JavaScript caller, strict
TypeScript caller, check corpus and installed declarations before execution.
The declarations must remain unchanged after TypeScript checking.

Existing report formats, two-root builds, source removal, offline installs
and compiler-free execution remain in place. The npm caller constants match
the hashes in the original installed acceptance report. Strict TypeScript
still uses `--strict --noEmit --skipLibCheck false`. Neither producer claims
to measure Lean dispatch. This change adds no installed support claims.

## Verification

The registered five-root source regression passed 161 tests with no failures
and six explicit installed/compiler skips in 104.80 seconds. Original TAP:
`build/vo1444-reviewed-package-records-regression-r1.tap`, SHA-256
`275ae69cea0ceac635aa27d3d1c9db51e6b65495cfc73850c34f881dfca1fcab`.
Full repository lint, JavaScript typechecking and all sixteen generated
reference checks passed. A later edit only corrects a new test file's comment.

The seven-transition source ledger starts at
`6c446492b1c6c471fc97e0a5bab4feeb24c06e38`. It refreshes sixteen source pins
without changing any of the 419 evidence entries' claims or 518 observations.
The independent audit matches all 5,834 older evidence files against Git.

Ledger: `reviewed-subtype-package-record-source-history-20261010.json`, SHA-256
`f43d248e5ad50909e38cd994660da74f69827711b49923310c6d195ef53a8d64`.
Audit: `build/vo1444-reviewed-package-records-audit-r1.json`, SHA-256
`484721523418743231003b0938e73c7c1ba91037917941dac90ccb922ef0ba47`.

Fresh installed runs must verify the retained records before CI wiring or
broader reviewed Subtype acceptance can be claimed. Browser, nested, nominal,
callback and remaining generic combinations stay open under #1220.
