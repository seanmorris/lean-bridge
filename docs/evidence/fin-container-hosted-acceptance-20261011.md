# Hosted native Fin container acceptance

All ten native profiles passed their measured container-edge, foreign-carrier
and complete late-input gates in [downstream run 38111996698](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698)
at `20539c53406f365d90e07251fd141c14ebf5fb0e`. Eight successful jobs cover nine
installed selections, including Python 3.11 and 3.12. The parent workflow has
an unrelated documentation failure; this note does not claim a green workflow.

The [hosted archive](fin-container-hosted-20261011/index.json) retains 196
artifacts plus its index: eight original ZIPs, their GitHub metadata, eight job
metadata/log pairs, complete ZIP-member inventories and 156 exact Git source
snapshots. Its index SHA-256 is
`20a16bc7de3c60a87874c8814816a9fd60e9fa2257b082b7d3aee621b3a9d78b`.
The ZIPs include other tests' records. Those records are preserved without
claiming that this audit establishes their acceptance.

## Original hosted results

Each selected late-input TAP records one actual installed test, zero failures
and zero skips. The strict checks require the hosted glibc 2.38 package floor
and the selected Python minor. Counts below are assertions per execution,
not numbers of independent tests or source entries.

| Profile | Edge assertions | Late-input assertions | Original job |
|---|---:|---:|---|
| C | 14,114 | 21,186 | [114389301545](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698/job/114389301545) |
| C++ | 14,099 | 20,162 | [114389301545](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698/job/114389301545) |
| Python 3.11 and 3.12 | 14,095 each | 20,158 each | [114389301525](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698/job/114389301525) |
| Rust | 14,078 | 20,141 | [114389301830](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698/job/114389301830) |
| Ruby | 14,094 | 20,157 | [114389301586](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698/job/114389301586) |
| .NET | 14,089 | 20,152 | [114389301516](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698/job/114389301516) |
| Java | 14,089 | 20,152 | [114389301495](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698/job/114389301495) |
| Kotlin | 14,088 | 20,151 | [114389301495](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698/job/114389301495) |
| Native PHP, weak and strict callers | 14,089 | 20,152 | [114389301536](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698/job/114389301536) |
| WIT/WASI | 14,066 | 7,065 | [114389301742](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698/job/114389301742) |

## Original #1427 and #1454 requirement audit

| Requirement | Actual source and retained evidence |
|---|---|
| Array/List/Option Fin and transparent aliases | The original [eight-export fixture](../../tests/fixtures/onboarding/native-fin-containers/FinContainers.lean) remains unchanged. The [additive fixture](../../tests/fixtures/fin-container-edges.lean) adds four exports. Each report checks the full refinement tree, source digest, generated consumer and original package identities. |
| Empty Array/List and absent Option at Fin 0; reject present/nonempty values | Every [edge caller](../../tests/fixtures/fin-container-edge-consumers/) exercises the three distinct containers. Absent Option and present empty List remain distinct. Values 0, 1 and a wide Nat cannot inhabit Fin 0. |
| First/middle/last invalid nested elements | Every edge caller exercises each Array-of-Option position, each Option-of-List position and all nine outer/inner positions in List-of-Array. Empty and inactive branches remain covered. |
| Bounds above 64 bits and valid endpoints | Original callers retain the List(Fin(2^70)) checks; additive callers retain 0 and 9 successes and bound/above-bound refusals. The original assertions are composed into each installed caller rather than replaced. |
| Malformed raw carriers and tags | The [foreign caller](../../tests/fixtures/fin-container-foreign-carriers.c) runs against every profile's receipt-verified installed native libraries. Its 77 cases cover required nulls, spans, nested pointers, invalid tags, inactive payloads and bound failures, followed by 1,000 refusal/recovery pairs per entry point. Each report retains 12,077 measured calls. This is a separate C probe, not a host-language call. |
| Late-argument refusal and complete unchanged inputs | The [late callers](../../tests/fixtures/fin-container-late-consumers/) compare both complete inputs, including NUL suffixes and full integer values, after 1,009 refusals and recoveries. Native callers exercise six independent snapshot mutations. WIT exercises eleven, including lengths and value kinds. C and WIT check unchanged output sentinels; the foreign probe also checks result slots and borrowed ownership. |
| Cleanup and recovery | Edge callers retain 1,000-pair loops across six exports. Raw/foreign probes check each call's counts, borrowed ownership and release behavior. Late callers recover in the same process or WIT session after every rejection. No allocator or peak-memory measurement is claimed. |
| Actual public-host and direct-adapter dispatch | Each report retains the complete host-specific public transcript separately from the 12,035-call raw-adapter probe. Both require nonzero valid controls, exact ordered counters, rejection observations and receipt-bound symbol definitions. Six adapters and two surviving source functions are measured; four inlined identity sources are explicitly unmeasured. The earlier #1436 Python/Rust host-process evidence remains unchanged. |
| Two-root reproduction, source-free/offline installation, immutability and relocation | Strict edge and late checks require these observations. The late archive retains both original models/receipts, source/configuration, installed receipt, host-specific installation checks and unchanged callers' pre/post-relocation output. No reader opens an old absolute installation path. |
| Preserve original failures and producer identity | Original ZIPs, metadata and complete job logs bind the accepted run to its checkout. Earlier [native late-input failures](fin-container-late-native-acceptance-20261011.md#failed-attempts-retained), [WIT diagnostic failure](fin-container-late-acceptance-20261011.md) and [disk-stop attempt](fin-container-late-native-disk-20261011.md) remain unchanged and are not counted as accepted. |
| Recurring registration, CI and history | The existing [downstream workflow](../../.github/workflows/consumer-matrix.yml) runs measured edge/foreign gates plus all nine late selections and uploads originals on failure. Workflow controls reject omissions and weakened failure handling. The hosted checks register through the existing fin-container-edges test root. This archive-only milestone changes no production source, historical artifact or support observation. |

The hosted results complete the pending hosted requirement in the earlier
[native acceptance audit](fin-container-late-native-acceptance-20261011.md).
Perl's separate container acceptance is unchanged. PHP-Wasm, broader Subtypes
and checked/dependent records remain open under #1220.

## Archive verification

The archive checker requires the exact job IDs, source revision, successful
comparison steps and matching GitHub artifact digests. It validates ZIP
structure, CRCs, member lengths and safe unique paths without extraction or
execution. The original edge, foreign-carrier and late-input checkers then
read all 163 required ZIP records. Their source and report assertions have
not been weakened for archival.

All five hosted archive groups pass. They reject 394 missing/corrupted
file/index cases, 163 missing required records, 128 provenance/ZIP mutations
and 117 coordinated report/TAP mutations. These controls test the checker;
they are not additional installed consumer runs.

The eight-root regression passed 103 tests, with zero failures and 29 explicit
compiler/installed gates skipped. The actual hosted installed selections above
have no skips. Its TAP is `build/vo1454-hosted-closure-regression-r1.tap`, SHA-256
`81129c871c1299dc91f91faba8c9c92bef6ad50de85497d6ba1ff67695939c35`.
The ten-root documentation, registration and current-source suite passed 144
tests without failures or skips. Full ESLint, checked JavaScript and all 16
generated reference checks pass.

An independent audit compares all 196 retained files with the original downloads
or exact Git source blobs. It uses system `unzip`, independently of the new ZIP
reader, to compare every member with the retained inventory. All 8,991 older
evidence files remain byte-identical. The 440-claim, 555-observation support
inventory is unchanged, SHA-256
`660b229d4657ba9d9fad5d79fb7b0cca986aa75bb93c6af1cf8e31609e48e72f`.
Audit output `build/vo1454-hosted-independent-audit-r2.json` has SHA-256
`e9fa00f01e98759655fa7ccc26b2ebf7af79d085639ecd81073f0ef37132fb17`.
The first audit attempt compared canonical JSON key order with ZIP entry order;
the corrected comparison requires identical unique paths and exact member bytes.
Its failed log is retained. Neither the archive nor its acceptance checks changed.
