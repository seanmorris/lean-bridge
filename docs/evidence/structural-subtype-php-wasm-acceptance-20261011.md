# Installed structural Subtypes in PHP-Wasm

Ordinary-source and independently reviewed PHP-Wasm packages passed at producer
`662cba28640b35b5708a8cba5116e9a0de2bf2ea`.

| Author route | Installed test | Duration | Lowest free disk |
| --- | --- | --- | --- |
| Ordinary source | 1 passed, 0 failed, 0 skipped | 213.6 seconds | 9,964 MiB |
| Reviewed API | 1 passed, 0 failed, 0 skipped | 197.3 seconds | 9,959 MiB |

Each route built identical component/runtime npm archives and a Composer API
archive in two author directories. The harness removed both author/build trees
before installation, verified the handoff receipts, installed offline with empty
caches, moved the installed tree, and replayed the public PHP callers without
compilers. It checked that execution left the deployment unchanged.

## Execution matrix

Each author route executed all twelve combinations below with PHP 8.4.1 and
32-bit PHP integers. Every combination passed 4,119 checks, including 1,042
expected rejections and six deliberately faulty snapshot controls.

| Host | Package loading | Library loading | PHP caller |
| --- | --- | --- | --- |
| Node | Embedded npm PHP assets | Startup and lazy | Weak and strict |
| Node | Installed Composer autoloader | Startup and lazy | Weak and strict |
| Chromium | Bundled npm PHP assets | Startup and lazy | Weak and strict |

The caller retains the complete native PHP assertion functions and all twelve
generated public API names. Only lexical strictness, autoload/entry handling,
reviewed argument labels and host metadata differ. The corpus covers Array,
List, Option, products, result branches, primitive Subtypes, transparent aliases,
mixed Fin bounds and a closed generic specialization. It checks independent
constructor choices, normalization, wide Nat values, UInt8, NUL/Unicode text,
all nine nested invalid positions, and 1,000 late rejection/recovery pairs with
both complete inputs unchanged.

The shared driver records ready, autoload, invalid and complete phases. Startup
loading retains both libraries throughout. Lazy loading keeps both absent until
the valid corpus runs; a scalar supplied to the array API fails before Lean
loads. Browser requests identify the actual component/runtime libraries, PHP
host Wasm and deployed caller. Both embedded and Composer paths use the pinned
Brick Math sources.

## Original records

The archive is
[`structural-subtype-php-wasm-20261011`](./structural-subtype-php-wasm-20261011/index.json).
It retains 133 originals plus its index: 94 run records, 37 exact producer source
snapshots, the runner and the report checker. Index SHA-256:
`da25a7fe6aae70c6f5c23713f7e65e0195fdccb59e5d7b27672007afaa825c5c`.

Ordinary TAP SHA-256:
`09e447089c3a97d5739166b0cca51775f3dd16f921c3ea4113ab998133b11b33`.
Reviewed TAP SHA-256:
`64a1876acb5d7f3623f62da9cbd029252ca911c88524dced2dba1f01fad0b220`.

The independent checker reads archive-relative records and exact producer source
from Git. It verifies both compiler models, independent constructor selections,
mixed Fin decisions, source identities, receipts, archive/deployment hashes,
generated public API bytes, package-manager locks, callers and all executions.
Historical absolute paths are retained as provenance and are never reopened.

Four registered archive tests pass. They reject 268 missing/corrupted originals,
86 missing required records and 280 coordinated changes to contracts, caller
bytes, dependency metadata, isolation flags, loading phases and execution counts.
The independent original-byte audit covers every archived record and Git source,
all 9,189 earlier evidence files, and the unchanged support inventory.

The five-root archive/current-source regression passed 69 tests with 22 explicit
compiler/installed gates skipped. The complete documentation suite passed 133
tests without skips; lint, checked JavaScript and all 16 generated references
passed. A broader PHP-Wasm regression retained 169 passes, one failure and 36
explicit gates: an older source test still expected rejection of Array Subtypes.
Its contract/history correction is a separate follow-up. This archive's installed
producers and four evidence tests passed independently of that stale assertion.

Both installed producers passed on their first attempt. Three earlier report
checker drafts failed on checker assumptions: Lake source-path metadata,
compiler-selection request shape, and the PHP generator's options argument.
Their logs remain under `build/`; none required weakening an installed test or
rerunning a producer. Formatting-check failures also remain there.

## Remaining acceptance

This archive records local installed acceptance. Required recurring structural
CI, hosted results and precise support-table/documentation promotion follow.
These unmodified packages do not measure constructor, adapter or source entries,
allocator behavior, or memory usage. Package binaries and complete toolchain
closures are not retained; their identities remain in the original reports.

Nominal/record/variant Subtypes, callback/owned combinations, broader generic
Subtypes and the remaining PHP-Wasm dependent transports remain open under
#1220, #1443 and #1444. Checked/dependent record expansion remains in #1446.
