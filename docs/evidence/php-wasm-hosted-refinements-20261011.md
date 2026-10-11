# Hosted PHP-Wasm refinement acceptance

[Job 114270644073](https://github.com/seanmorris/lean-bridge/actions/runs/38071834965/job/114270644073)
succeeded at `d177236cdc80b69ca2210b8fd19f59ba440d1dea`. Its shared installed
corpus step completed successfully. This archive preserves the original hosted
Fin and Subtype observations; it does not rerun their producers.

The [archive index](php-wasm-hosted-refinements-20261011/index.json) authenticates
104 files: the original GitHub artifact ZIP and metadata, job metadata and log,
a ZIP membership manifest, and 99 source snapshots from the producer revision.
Index SHA-256:
`10690926c4e39c4a6f98c49d8719b547f6e6cea9d46f3e0b3d0eb97be21e1e71`.

GitHub artifact `11685379051` contains 111 members. Its original compressed size
is 3,016,912 bytes and its SHA-256 is
`046a23daad626a480eb007e434ffa053ed2392f79ea1f9d10842d98ff82942df`.
The archive reader verifies that identity before parsing the ZIP, checks local
and central headers, lengths, member uniqueness and CRCs, then compares every
member with the recorded manifest. It neither extracts nor executes members.

## Verified observations

| Report family | Hosted executions | Scope |
|---|---:|---|
| Direct Fin | 48 | Scalar and container fixtures, ordinary and independently reviewed routes |
| Checked Subtype | 24 | Ordinary and independently reviewed primitive-base constructor decisions |
| Subtype entry probes | 24 configurations | Separate instrumented packages, both routes, 2,024 assertions and 2,030 measured calls per configuration |

The direct-Fin and unmodified Subtype reports do not measure entry counts. The
instrumented Subtype probes separately record validator, constructor, adapter
and source entries, with nonzero controls and the complete rejection/recovery
sequence. The checker reconstructs the probe builds from the original retained
C inputs, instrumented C files, model, commands and observations. It also
requires the original installed probe TAP to contain two passes and no failures,
skips or cancellations.

All six selected reports pass the existing independent report validators.
Those validators check reproducible package identities, source removal before
offline consumption, exact ordinary/reviewed selections, installed package and
runtime files, PHP weak/strict callers and the Node/Chromium execution matrix.
The job log retains the corresponding successful checker output.

The job's failure-enforcement step is named `Enforce PHP support`. GitHub records
it as skipped because the preceding tests succeeded. That is distinct from a
skipped installed test. The first draft archive check expected a differently
named successful enforcement step and failed; the corrected check authenticates
the actual original step and its skipped outcome. No producer result changed.

## Preservation and remaining work

The archive tests reject missing or changed archive files and members, corrupted
ZIP bytes, missing source routes, missing probe build records and a skipped
installed-probe TAP. These tests run through the existing PHP-Wasm Fin test root.
An exact five-file source-history layer records test registration and the README
repair below. It refreshes 13 current source pins without changing support
claims, observations, or earlier archived evidence.

Only the named refinement reports receive new hosted acceptance here. Other
members of the original artifact remain preserved without additional support
claims. The archive contains selected sources and reports, not compiled package
binaries or a complete toolchain closure. Recorded absolute producer paths are
historical data; readers use the repository-relative archive and in-memory ZIP
members.

#1443 remains open for the original graph, owned-resource, callback and dependent
refinement combinations. #1444's nested/nominal/generic Subtypes and #1446's
broader checked/dependent records remain separate requirements under #1220.

## Subsequent CI regression repaired

The later PHP-Wasm job `114341674858` at `c9d11f7` failed its README assertion.
The shared native README generator had removed an obsolete reviewed-IR exclusion.
PHP-Wasm's scalar text replacement still matched only the older wording, so the
generated README incorrectly excluded supported containers, records and variants.
The unchanged regression test reproduces that failure locally.

The replacement now also matches the current scalar sentence and reports the
PHP-Wasm profile's actual exclusions: callbacks and generic record instantiations.
Scalar, container, product, record and Subtype fixture assertions remain required.
The original later job log is retained at
`build/vo1220-php-wasm-c9d11f7-114341674858.log`; it is not relabeled as a pass.
The fix needs a new hosted run. It changes package documentation and packaging
source identity, not the algorithm or foreign ABI.

## Verification

The independent precommit audit compared every original archive file with its
retained download or exact Git source, and all 111 ZIP members with the retained
extraction. All 7,503 earlier evidence files remain byte-identical. Five exact
source transitions refresh only the 13 PHP-Wasm packaging-source pins; all
support claims and observations remain unchanged.

Source-history ledger SHA-256:
`1b3424291eaf4373bfab3b2837d4303a43a16dd9172de23ff948113769bf2f3a`.
Audit: `build/vo1443-hosted-audit-precommit-r3.json`, SHA-256
`dfab8fb9d2c0f4ce5ef872d753d987c6e071314b7e6b479302efb03c6a98d10e`.

Full ESLint, checked JavaScript and all 16 generated-reference checks pass.
The archive corruption tests reject 210 missing or changed file/index cases.
The first broad regression exposed the README defect above. The second exposed
an older history test comparing today's inventory directly against its own
milestone. That test now authenticates subsequent recorded transitions before
checking its original exact digest; unknown edits still fail. Both failed TAPs
remain in `build/vo1443-hosted-archive-regression-r{1,2}.tap`.

The final six-root regression passed 239 tests, with zero failures and 39
explicitly gated compiler/installed tests skipped. Those skips do not represent
new installed acceptance. TAP: `build/vo1443-hosted-archive-regression-r3.tap`,
SHA-256 `d0f6ad850a8d72859d49123b6026a438eefb47a0a54eb98bac20e97d457ea057`.
