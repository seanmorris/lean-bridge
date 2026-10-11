# Installed structural Subtypes in Node and browsers

Ordinary-source and independently reviewed npm packages passed at producer
`6080ad606975aea3e54fba6f4f652a78df223171`.

| Author route | Installed test | Duration | Lowest free disk |
| --- | --- | --- | --- |
| Ordinary source | 1 passed, 0 failed, 0 skipped | 303.6 seconds | 10,240 MiB |
| Reviewed API | 1 passed, 0 failed, 0 skipped | 310.0 seconds | 10,230 MiB |

Each route built identical runtime and component archives in two independent
author directories. It removed both author/build trees, verified the receipt,
installed the prepared archives offline with an empty npm cache, and ran the
public JavaScript caller and strict TypeScript checker. Both passed again
after the complete installation moved. The harness compared every installed
component/runtime file against the archive contents before and after execution.

Separate JavaScript, React and worker consumers installed those same prepared
archives. Their bundles ran after the harness removed installed sources and
build tools. Each profile checked the installed component and shared runtime
against the original npm package hashes. Browser requests could not reach an
external network; downloaded Wasm bytes matched the installed archives.

## Execution matrix

Each author route passed this matrix in Chromium 151.0.7922.34, Firefox 153.0
and WebKit 26.5:

| Consumer | Build variants | Lifecycle observations per engine |
| --- | --- | --- |
| JavaScript page | Production | First run, rerun, failed-asset recovery |
| React | Production and Strict Mode | First run, two remounts, failed-asset recovery, pending unmount |
| Dedicated worker | Production | First run, rerun, worker restart, failed-asset recovery |

Across both author routes, the archive retains four Node executions, 24 browser
engine/build executions and 102 browser lifecycle observations. Every caller
execution reports 3,028 checks and 1,020 expected rejections. React records effect,
cleanup and ignored-result counts; worker records require two creations, two
terminations and no remaining live worker.

The twelve-export corpus covers scalar Subtypes, Array, List, Option, products,
result branches, UInt8/Nat combinations, transparent aliases, mixed Fin bounds
and a closed generic specialization. It checks separate constructor choices for
alias sites and parameters, exactly-once normalization, embedded-NUL text and
1,000 late rejection/recovery pairs with both complete inputs unchanged. The
nested mixed-Fin fixture checks one bad position; this run does not establish
the nine-position coverage recorded by the newer native callers.

## JavaScript snapshot correction

The earlier JavaScript oracle encoded bigint values as strings ending in `n`.
A deliberately faulty mock could return `"123n"` instead of `123n` and pass.
The new caller uses tagged deep snapshots that preserve primitive types, array
holes, missing properties, undefined values and complete strings. It rejects
accessors, custom serialization, unsupported prototypes, symbol keys and cycles
without invoking user code. Repeated noncyclic references remain valid.

Eighteen independent distinction controls and faulty API mutations exercise the
oracle. These mock results identify a test gap, not a generated-runtime failure.
The installed Node and browser runs use the corrected caller. Earlier npm
archives remain unchanged and readable through their original producer revisions.

## Original records

The archive is
[`structural-subtype-browser-20261011`](./structural-subtype-browser-20261011/index.json).
It retains 182 originals plus its index: 148 run records, 32 exact producer source
snapshots, the runner and the report checker. Index SHA-256:
`0b1cabff5ddeb23ea47252a796975901ce65c6d9bcc82867bf043adc28a383e1`.

Ordinary TAP SHA-256:
`57912956404c5279a24fceda595d44f56ac378b74e58d8649b8434ae1b100b5a`.
Reviewed TAP SHA-256:
`748ca90f8bfab851050d68c0a07354ffbee1835d94830cdec9ac99242948c126`.

The independent checker reconciles both original compiler builds, receipt and
runtime identities, caller bytes, installed declarations, npm dependencies,
bundled assets and every browser lifecycle observation. It reads source bytes
from the frozen Git revision. Historical absolute paths remain provenance and
are never reopened by archive readers.

All four archive tests passed. They reject 366 missing/corrupted originals,
142 missing required run records and 242 coordinated report/package mutations.
The first negative-test draft assigned a dependency its existing version and
therefore made no change; the corrected test requires an actual mutation.
Neither installed producer failed.

An independent audit compared every archived original with its producer,
including all 32 source snapshots from Git. All 8,807 older evidence files and
the complete 440-claim/555-observation support inventory remain unchanged.
The seven-root source regression passed 69 tests, failed none and skipped
22 explicit compiler/installed gates. Those skips do not replace the two
successful installed producers above.

With the archive tests registered, the final seven-root regression passed
73 tests, failed none and skipped the same 22 explicit gates. All 133
documentation tests and sixteen generated-reference checks passed. Full
repository lint, final changed-file lint and checked JavaScript also passed.

## Remaining acceptance

These are local Linux runs. They do not measure constructor/source entry counts
or memory behavior. The archive does not retain package binaries or complete
toolchain closures. Recurring structural CI and exact support-table promotion
remain separate work.

The author guide still describes structural acceptance as in progress. Its
support-table update will follow PHP-Wasm acceptance and recurring CI, with an
authenticated source-history transition. A draft link update exposed the
guide's existing source pins; this milestone keeps the guide and those pins
unchanged and documents the new observations here.

PHP-Wasm acceptance and broader nominal, callback, owned and generic Subtype
combinations remain within VO #1444 and #1220. This browser milestone does not
close those requirements.
