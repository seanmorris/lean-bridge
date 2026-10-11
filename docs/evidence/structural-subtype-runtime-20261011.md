# Structural Subtype compiler and runtime support

This milestone implements the structural-container portion of VO #1444 through
fresh Lean extraction, independent admission checks and generated adapters.
Installed-package acceptance remains pending. Nominal fields, callback and
owned positions, and broader generic combinations remain open requirements.

## Implementation

The compiler carries checked-constructor selections through Array, List,
Option, Prod, Except and transparent aliases. Each selected constructor must
accept the exact primitive base and return Option of the exact source Subtype.
Unsafe constructors and constructors depending on `sorryAx` are refused.
Except selections follow transport order, success then error.

A separate Subtype position flag prevents structural admission from enabling
nominal fields or callback positions. Constructor choices remain local to each
export site, including two uses of one structural alias with different
normalizing constructors. Independently validated reviewed contracts retain
the complete selection tree and its compiler-owned Fin branches.

Native adapters emit a validator for each constructor leaf. The generated C
boundary checks every raw shape and every reachable Fin bound before invoking
constructors. Constructor diagnostics include the rejected element's actual
index and selected constructor. Dispatch reconstructs values from the original
input and passes the constructor's normalized values to Lean. Perl traversal
distinguishes boxed and unboxed leaves; JavaScript's Fin traversal skips only
constructor leaves, not entire mixed trees.

## Verification

The fresh source check runs four compiler invocations across native and
component profiles. It validates the reports against the schema, metadata
contract and semantic model. Generated Lean executes 13 checks covering
normalization, distinct alias choices, late rejection, empty and absent values,
result branches, UInt8 bases, bounds wider than 64 bits and a closed generic
specialization. The generated C adapter compiles with C11, `-Wall`, `-Wextra`
and `-Werror` against the pinned Lean headers. The single enclosing test passed
without failures or skips.

Fresh-source TAP: `build/vo1444-structural-extractor-fresh-r8.tap`, SHA-256
`fd5fd2f4a3fdb09790fb93d173c89c102893b35e6b736896994882c2d9b3c972`.
Original requests, reports and generated sources remain in
`build/vo1444-structural-source-r8/`. These local outputs are not an immutable
installed-package archive or an independently authored reviewed-package run.

The twelve-root regression passed 352 tests, with zero failures and 37
explicitly gated compiler/installed tests skipped. TAP:
`build/vo1444-structural-runtime-regression-r3.tap`, SHA-256
`83377ba59223139f77e5008c83493db893d782b2aa91344b720364b494b37356`.
Separate scalar compatibility checks passed seven tests without failures or
skips. Checked JavaScript and all 16 generated reference pages passed.

Earlier attempts found and corrected an actual generated-Lean pattern
inference failure in tuples containing optional Subtypes. Qualified Option
and Except patterns resolve it while preserving Fin-only output bytes.
Regression repairs also authenticate newer source-history transitions for
Buffer inputs, compare historical CI snapshots at their recorded milestone,
and isolate a compiler-origin fixture from unrelated archived IR files in
the repository. Existing live-workflow assertions remain enforced.

## Evidence preservation

The independent Git audit verified 29 exact source transitions and 738
source-pin-only updates. All 440 evidence claims, 555 observations and 7,616
earlier evidence files remain unchanged. Source-history ledger SHA-256:
`a645fcf9916170cf24770ec483851408eaa923bc1187e95085e3cdac542d524e`.
Audit: `build/vo1444-structural-runtime-audit-final.json`, SHA-256
`fd5c6c5316f6c78863625f574ab614bc173c2a46c2020d8f13a2944e9ff61819`.

## Remaining acceptance

Build ordinary-source and independently authored reviewed packages from two
author roots. Remove those sources before offline installation, move the
installed tree, and replay unchanged callers. Check exact error paths,
normalization, unchanged inputs after late failures, mixed Fin checks before
constructor/source entry, wide values and repeated recovery. Start with C/C++
and npm with strict TypeScript, then cover the other native, browser,
PHP-Wasm and Perl profiles. Preserve original reports and require recurring
CI before promoting any structural-Subtype support cell.
