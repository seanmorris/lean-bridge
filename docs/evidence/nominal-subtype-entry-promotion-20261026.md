# Nominal Subtype constructor and source-entry measurement

These retained GitHub-hosted runs measure separate instrumented packages. They do not add instrumentation to release packages and do not change any support cell.

| Lane | Original run | Measured execution | Boundary |
| --- | --- | --- | --- |
| Native | Run 40047587455, producer `390ae18d3a2607bc73463767a33fea0cfb9350b0` | Ordinary and reviewed full C: 4 executions, 4,149 C checks and 4,122 C++ checks per route. Result-only: 4 executions and 2,042 checks per consumer per route. Linux x64/glibc 2.39, declared floor 2.38. | C full packages count public, validator, selected constructor, adapter and Lean-source entry. C++ executes without entry counters. Result-only records explicit nonmeasurement. |
| Browser | Run 40063486749, producer `4a5f3ad87b829e6363cd655d8d39d252344ba8a5` | Per route and mode: 2 Node and 12 browser executions across Chromium, Firefox and WebKit, with 51 lifecycle observations. Full: 3,172 checks and 1,032 expected rejections. Result-only: 2,078 checks. | Full packages record public JavaScript, validator, selected constructor, direct adapter and Lean-source entry. Result-only records explicit nonmeasurement. |

Both lanes cover ordinary-source and independently reviewed packages, valid and normalizing constructors, invalid-only paths, inactive branches, late failures and recovery. The archives retain the original GitHub API responses and artifact ZIP bytes plus the exact producer, checker and archiver source closure; the Core test reconstructs and independently replays every selection.

External compilers, runtimes, package managers, browsers and operating-system distributions remain trusted recorded inputs.
