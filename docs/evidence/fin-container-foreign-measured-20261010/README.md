# Installed native Fin foreign-carrier acceptance

All nine local installed selections passed at producer `3ca155faffbe5ee9ea2a491bf28728579c10f2d5`. They cover C/C++, Python 3.11 and 3.12, Rust, Ruby, .NET, Java/Kotlin, native PHP and WIT/WASI. Each selection rebuilt reproducible packages, removed the author/build roots, installed offline and exercised the relocated package's public API and raw entrypoints.

The additive foreign-carrier caller uses the production-generated C header and the actual installed native library. It runs 77 structural and bound cases, including 65 refusals and 12 positive controls, plus six 1,000-pair rejection/recovery loops. Each package records 12,077 calls. Refusals preserve caller data and output sentinels and do not enter the measured adapters or source functions. Four inlined identity functions remain unmeasured at source level.

The caller is separate from the public-language consumer. Its observations do not stand in for a Java, Python or other host-language call. Each report retains the earlier raw and public-host observations alongside the foreign-carrier supplement.

## Original artifacts

The [index](index.json) authenticates 882 original files: six execution records for each of nine selections, the archiver and 827 Git source snapshots. Original report, runner, start, end, TAP and verification records remain byte-for-byte unchanged. Index SHA-256: `e92626c5485297165da79fa6203426ac28e2d8cd171f91c6e4f037dfcf269212`.

The [archive tests](../../../tests/helpers/fin-container-foreign-measured-evidence-tests.mjs) authenticate every file and rerun the strict raw/public/foreign report validator. Corruption controls alter reports, logs, runners and source bytes.

These are local glibc 2.36 executions. They do not establish hosted glibc 2.38 or GDB 15 acceptance. Absolute paths in the original execution records describe the producer; CI validates the repository-relative archive and does not execute those local runners.

The earlier [bounds and public-call archive](../fin-container-edges-measured-20261010/index.json) remains unchanged. Its reports predate the foreign-carrier supplement and are not relabeled.
