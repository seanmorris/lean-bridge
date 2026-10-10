# Reviewed C/C++ and npm acceptance gates

Frozen commit `5b3f2efaeba2ea8257a6e62b0c6c3722a7713601` passed fresh
source-free installed acceptance for C, C++ and npm with strict TypeScript.
Each producer built the independently reviewed twelve-export Lean package
from two roots, verified matching archive identities, deleted author/build
inputs, and installed one handoff offline with no compiler on the consumer
search path.

The C/C++ producer passed 2,033 C checks and 2,026 C++ checks in 383.72 seconds.
Its original TAP records one passing installed test, zero failures and zero
skips. The local controller then returned failure because its postcondition
expected four caller rows instead of the producer's two. The producer builds
twice for reproducibility and executes the installed callers once. The
original controller, TAP, report and process result remain archived. The
independent report checker accepts both original build records without
editing them. No replacement passing controller transcript was created.

The npm producer passed 2,036 checks, including 2,024 rejection cases, in
89.65 seconds. Its installed declarations passed TypeScript with `--strict`
and `--skipLibCheck false`. The corrected controller and independent checker
both passed. It used the frozen local component engine. Hosted acceptance
will use the configured locked engine.

## Original records

`reviewed-subtype-package-runs-20261010/index.json` authenticates 66 original
artifacts, including both producers' retained records, two controller
sources, original TAP/process records and nineteen frozen source snapshots.
Index SHA-256:
`63b7b9a064f2d1fd3260882bbf09967b67de5f0b4ee6448bee19b96f4f79c30a`.

C/C++ TAP SHA-256:
`35b808162c4ece3a220b298b8091fa87b95a24f42808c94825924376fdad951e`.
npm TAP SHA-256:
`c186a719420a6f2018f01b7c621cbaff75e7d0019bf023df30592a9956f67aa4`.

Local native packages used the explicit glibc 2.36 test floor. The new
hosted shell refuses local floor overrides and keeps the default 2.38 floor.
The archive does not retain package binaries or a complete toolchain closure.
These runs do not measure entry counters or relocated replay.

## Recurring CI

`scripts/run-reviewed-subtype-package-ci.sh` accepts only `c-cpp` or `npm`.
It refuses stale output directories, captures both original output streams,
propagates producer failures and then runs
`scripts/check-reviewed-subtype-package-reports.mjs`. The checker requires
exactly one passing selected installed test with no skipped, duplicate or
missing TAP totals.

C/C++ checks match both native models, receipts, independent reviews,
constructor choices, source identities, generated symbols, carrier types,
caller bytes and exact result counts. npm additionally checks every author
input in the build plan, compiler adapters, private ABI, bundle inventory,
provenance, runtime requirement, package receipt and strict TypeScript caller.
It regenerates the expected declarations from the authenticated Binding IR.
Report consistency checks supplement the actual producer execution; they do
not execute or reauthenticate deleted package archives.

The C-family corpus step runs the native gate after its ordinary Subtype
test. Existing final outcome enforcement covers it. A required npm step
selects the existing locked engine and runtime; Node consumer success records
now also require this step to pass. Both jobs upload complete original record
directories on failure as well as success. Other commands, time limits and
uploads remain in place.

Thirteen focused tests passed without failures or skips. Controls reject
lost records, stale directories, changed models with updated report hashes,
weakened TypeScript settings, permissive outcomes, wrong execution names,
omitted workflow gates and discarded failure evidence. Original focused TAP:
`build/vo1444-package-ci-focused-r1.tap`, SHA-256
`eef9e3c0fbfd991f7dbb492a3341809e5b9a0499924d640cb1403a2f2425b11c`.

The seven-root registered regression passed 653 tests with zero failures and
seven explicit installed/compiler skips in 150.76 seconds. Original TAP:
`build/vo1444-package-ci-registered-r1.tap`, SHA-256
`b0754ac2017956c811fb9313e0c91f969da9d46f922cbde686c0944fd62829e4`.
Full repository lint, JavaScript typechecking and all sixteen generated
reference checks passed.

The nine-transition ledger starts at the frozen producer commit and refreshes
131 current-source pins. All 419 evidence claims and 518 observations remain
unchanged. The independent audit matches all 5,836 older evidence files
against Git. Ledger SHA-256:
`c7ec3c041f06c1b6d85b04cd1c4c9b03b87c59709be7c009a4d338a43a017a3f`.
Audit: `build/vo1444-package-ci-audit-r1.json`, SHA-256
`7224f7720efee0a449be63b1d434c925d9cf7d8dc7d5ce9fc015b737de13ff25`.

Hosted execution of these new gates remains required. Reviewed browser
pages, React effects, workers, nested/nominal/callback Subtypes and remaining
generic combinations remain open under #1444 and #1220.
