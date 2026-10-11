# Installed checked records on Rust, .NET, native PHP and WIT/WASI

Producer `c9d11f7ac8fd76d13bcc48f6f679eb22fd86b722` passed all sixteen
host/route selections. Each host consumed ordinary-source and independently
reviewed packages, plus separate result-only packages for both source routes.
Full callers completed 9,024 checks; result-only callers completed 1,002.
Every selection repeated after moving the installed consumer tree. Native PHP
ran in both weak and strict modes.

Each route reproduced matching packages from two author roots, removed the
author roots before offline installation, verified package inputs and ran the
consumer without Lean on its execution path. The selected local package floor
was glibc 2.36. These runs do not measure Lean entry counts or establish hosted
glibc 2.38 acceptance.

## Original records

The [archive index](checked-record-remaining-hosts-20261010/index.json)
authenticates 152 artifacts, including 37 Git source snapshots. Its SHA-256 is
`787affd873d405b9ad25ba695cea970f203611b4ac1a0b9740a0514f4cec73eb`.
The archive retains both author models, expected contracts, package receipts,
original callers, host results, TAP, runner and queue records. Package binaries
and a complete toolchain closure are not retained.

| Route | Original TAP SHA-256 | Minimum free space |
|---|---|---:|
| Ordinary source | `60428133946ef269f4c4f3e7324822920e1b8f653443b63a6676e362bfc3bb41` | 1,641 MiB |
| Reviewed IR | `b8d422e5e38423ba90cbf033d4d1e809bc0b785cf9038930341d0959ed842077` | 1,680 MiB |
| Ordinary result-only | `0a2e3dd00de6eeb5fc1c66e7ec5ecd745696918e827edd714480479b4f3979e5` | 1,657 MiB |
| Reviewed result-only | `5c09f759b8beff223f53de30b86c1b4f8ad4af17e4a04839f6bc8fc6c490eb4d` | 1,642 MiB |

All four producers passed one test with zero failures or skips. Every start met
the 2,048 MiB floor; none reached the 768 MiB disk stop.

The earlier attempt at `aed50e1` failed during PHP setup because the selected
local PHP 8.5 installation lacked `ctype.so`. Its two author records, partial
.NET result, original failure TAP and queue remain under `failed-php-tool/`.
That attempt reached neither Rust nor WIT and produced no completed combined
report. Its TAP SHA-256 is
`3ca41163c97ab1952eb3414a3e34bfb9fbe899561894bd5260d37ff03bab0b7d`.
The successful retry selected system PHP 8.2.33 after checking its extensions
and Composer. The producer and queue scripts did not change.

## Rechecking and recurring CI

The registered archive tests authenticate all original bytes and independently
check the selected constructors, proof-free results, expected models, exact
callers, receipts and relocation observations. They also check NuGet caches,
build inputs and deployed files, and PHP dependency/autoload files and runtime
flags. Rust and WIT producers verify installed package closures; their reports
do not contain an additional .NET/PHP-style environment inventory.

`scripts/run-checked-record-host-ci.sh` prepares eight CI lanes, including both
Python floors and a combined Java/Kotlin lane. Each lane requires all four
routes, retains partial output on failure and refuses stale output. Its report
checker requires an actual zero-skip installed pass for the exact route and
validates the original records. The runner rejects local glibc-floor overrides.
Workflow invocation and unconditional uploads remain the next integration step.

This milestone updates the author guide and preserves every earlier support
observation. Support-inventory promotion remains separate. Perl, PHP-Wasm and
browser checked-record execution, broader nested/dependent records and the
remaining original #1220 requirements stay open.

## Verification

The focused archive/history/CI checks passed ten tests without failures or
skips. They reject 459 missing/corrupted originals and 324 altered semantic
claims. The CI shell controls exercise all eight lanes and stop after producer
or checker failure while retaining partial output. The real CLI accepts all
sixteen original run groups across the Python, Ruby/JVM and remaining-host
archives. Stand-in shell checks do not establish new installed execution.

The eight-root registered regression passed 204 tests with zero failures and
18 explicit installed/compiler-gated skips (222 total). Original TAP:
`build/vo1446-remaining-registered-r1.tap`, SHA-256
`bd62a7764ce5e5b33be97dbb201516bcd5316e8619b0496123915b3a49a89764`.
Full lint, checked JavaScript, ShellCheck and all 16 generated-reference checks
passed. Earlier draft lint failures remain in their separate build logs; the
local formatter damaged two draft test object literals, which were repaired
before the final tests and lint.

An independent audit matched all 115 execution/runner records and 37 source
snapshots to their originals. The exact history ledger records seven source
transitions and 18 source-pin updates. All 420 earlier evidence claims, 519
observations and 6,327 older evidence files are unchanged. Ledger SHA-256:
`f98ed2ca68fb8ef8d538e615509d7670ea08f4981c83ee19cc7a65ee44ab0287`.
