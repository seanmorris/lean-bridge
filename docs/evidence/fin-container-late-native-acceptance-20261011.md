# Complete native Fin late-input acceptance and recurring CI

All ten profiles now have installed evidence that late-argument rejection leaves
both complete caller inputs unchanged. The nine native callers passed eight
installed selections, covering both Python minors. WIT/WASI passed its separate
installed test, already retained in the [WIT archive](fin-container-late-wit-20261011/index.json).

## Native runs

Every selection passed one installed test with zero failures or skips. Each
reproduced package archives from two author roots, removed each author before
installing its package offline, and executed without Lean or native compilers
on its execution path. The harness relocated the complete first installation
and replayed the unchanged caller before producing the second build.

| Profile | Assertions per execution | Producer |
|---|---:|---|
| C | 21,186 | `5c5d7c6` |
| C++ | 20,162 | `5c5d7c6` |
| Python 3.11 and 3.12 | 20,158 each | `838c554` |
| Rust | 20,141 | `838c554` |
| Ruby | 20,157 | `838c554` |
| .NET | 20,152 | `838c554` |
| Java | 20,152 | `838c554` |
| Kotlin | 20,151 | `838c554` |
| Native PHP, weak and strict modes | 20,152 | `838c554` |

The callers retain every original container-edge assertion and add 1,009
rejection/recovery pairs. Both inputs are compared in full after every refusal
and successful recovery, including string suffix bytes after an embedded NUL.
Six deliberate input mutations test each caller's snapshots. C also preserves
the poisoned output slot. These supplements measure behavior, not entry counters.
The earlier public-host, direct-adapter and foreign-carrier measurements remain
separate and unchanged.

The [native archive](fin-container-late-native-20261011/index.json) retains 306
artifacts, including 112 source snapshots from the exact producer commits,
models, receipts, execution logs, runner bytes, retained output and mutation
results. Its index SHA-256 is
`3edacf6acd8bbdcf377b23871235d80d92c577fa121aa9c2f8046bcc4d0c3491`.
The strict checker accepts all eight original reports and rejects 522 report
mutations. Archive controls reject 614 missing or corrupted file/index cases.
All runs use the local glibc 2.36 floor. The archive retains package hashes and
selected source files, not package binaries or complete toolchain closures.

## Failed attempts retained

The C/C++ producer passed, but its first wrapper check expected a source identity
in the wrong receipt location. The corrected checker authenticates the original
model pinned by the C-family receipt, plus the component and adapter receipts.
The original failed check and successful correction are both archived; the
producer was not rerun.

The first PHP attempt selected a minimal PHP 8.5 toolchain without `ctype.so` and
failed during installation setup. Its original TAP, queue, runner, partial
records and relevant source files remain under `php-r1-failed/`. The corrected
runner selects `/usr/bin/php`, as the earlier accepted PHP edge producers did.
PHP R2 passed with that installation's required extensions. Its checker rejects
all 58 mutation controls. No package implementation changed for this repair.

The earlier grouped Python/Ruby/Rust attempt stopped for disk pressure during
its second build. Its separate [failed-attempt archive](fin-container-late-native-disk-20261011.md)
remains unchanged and is not counted as accepted.

## Required recurring gates

The downstream workflow now invokes the native runner for eight selections and
the separate WIT runner. Each runner requires fresh output, retains original
TAP, propagates producer and checker failures, and checks the hosted glibc 2.38
package floor. Python lanes select their exact interpreter minor. Every consumer
job uploads complete or partial records even when its gate fails.

The WIT checker authenticates both original models and package receipts, source
and configuration, the installed receipt, exact caller, output and the complete
rejection/recovery counts. The native checker additionally enforces each host's
recorded installation checks and PHP's separate strict-mode execution.
CI tests reject missing commands, wrong Python selections, weakened failure
handling and omitted uploads. Existing measured edge gates remain in place.

The exact source-history ledger records five transitions from `838c554` and
refreshes 117 workflow and documentation-test source pins. Earlier evidence and support claims are
unchanged. Recorded absolute paths identify original producers; archive readers
use repository-relative files and CI creates its own fresh installations.

## Original requirement audit

| Original #1427 requirement | Evidence |
|---|---|
| Empty Array/List and absent Option at `Fin 0`; present/nonempty rejection | All ten profiles in the [measured edge matrix](fin-container-edges-measured-20261010/README.md) |
| Invalid first/middle/last nested elements; wide bounds and valid endpoints | The same matrix retains the original eight exports and additive nested-position callers |
| Malformed foreign pointers, spans and tags | All ten packages in the [foreign-carrier matrix](fin-container-foreign-measured-20261010/README.md), with independent raw callers |
| Late-argument rejection, complete unchanged inputs and error outputs | This native archive and the separate WIT late-input archive |
| Repeated cleanup and successful recovery | Each matrix retains its 1,000-pair loops; late-input callers retain 1,009 pairs |
| Actual public-host and direct-adapter dispatch | The measured matrix records public calls separately from raw adapter calls; four inlined identity source functions remain explicitly unmeasured |
| Reproducible builds, offline/source-free installation and relocation | Original models, package receipts and installed reports retained by each matrix |
| Recurring CI and current documentation | Explicit measured, foreign-carrier and late-input workflow gates; this audit supplements historical milestone notes |

Fresh hosted acceptance of the new late-input gates remains pending. The broader
PHP-Wasm, Subtype and checked/dependent-record requirements under #1220 are not
closed by this container milestone.

## Verification

The eight-root registered regression passed 202 tests, with zero failures and
29 explicitly gated compiler/installed tests skipped. The actual installed
producers above have no skips. Original final TAP:
`build/vo1454-late-ci-archive-regression-r2.tap`, SHA-256
`62d293ea31424aaa81553659b2a9ac11b1a45f82a2281e41fefdf768e7b5f176`.
The separate foreign-carrier, entry-CI and diagnostic-CI audit passed all 24
tests without skips. Its TAP SHA-256 is
`e4ed8946a04c10b0048d0e4e58965c007094bb32cfba062ce2f68f1857b3baac`.

Focused checks passed 16 tests, and the final command-order/history checks
passed five. Earlier failed runs remain under `build/`: the first history test
incorrectly expected the oldest normalizer to recognize a new unpinned test
file; the first broad regression needed the documentation test to validate and
remove this milestone's additions before checking the older command sequence.
Neither correction changes earlier acceptance requirements.

The independent precommit audit matched every archived original, including all
112 Git source snapshots, and verified that all 7,194 older evidence files,
440 evidence claims and 555 observations remain unchanged. Only 117 current
source pins move. Audit SHA-256:
`ada24b4503f2f3d8e7d0d98424ba7002b9f2c83eadb395b9d09fce57390eb43c`.
Ledger SHA-256:
`88cdeb087aa811ab8053d18d8f13ac4e69aea6a4ceaeb5bb3b17e6678e6439ba`.

Targeted ESLint, checked JavaScript, both runners' ShellCheck and all 16 generated
reference checks pass. Actionlint 1.7.12 passes with its ShellCheck integration
disabled. With ShellCheck enabled, it reports the same 41 warnings as the exact
predecessor workflow; this milestone introduces no additional shell warnings.
