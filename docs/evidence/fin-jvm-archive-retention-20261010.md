# JVM diagnostic archive retention repair

The cleanup preflight found that `fin-jvm-exit-diagnostics-20261010/index.json`
listed `hosted-failure.log`, but the main checkout and Git tree did not contain
it. The log existed in the original build output and an idle worktree. Both
copies matched the index: 476,283 bytes, SHA-256
`4f28f167fb17ecab1c3c1853823e25a34c7ac52d7ead9b88deed8cb725ece693`.
Git history contained no version of this archive path. The global `.log` ignore
rule requires explicitly adding it to Git.

The repair restores those exact bytes. All other 88 indexed files are unchanged
from the preceding Git tree. The original index remains byte-identical, with
SHA-256 `b093c653bfcebc45b78d3a91a3806f5f96d23adb7a22a42522b29480a0082a2e`.
No original observation, support claim, source ledger or producer is rewritten.

The existing eight JVM diagnostic/history tests passed while this log was
missing. New archive tests first failed with the missing-file error in
`build/vo1454-jvm-archive-missing-regression-r1.tap`. They now authenticate the
pinned index and all 89 artifacts using archive-relative paths. Controls reject
90 missing files, 90 appended-byte changes and 81 same-length changes, including
the index. The tests run through the existing registered
`tests/fin-container-edge-report.test.mjs` root.

After restoration, that registered root passed 31 tests with zero failures and
one explicit installed .NET gate skipped. The result is retained in
`build/vo1454-jvm-archive-integrity-r2.tap`. Changed-file lint and checked
JavaScript passed. The first lint attempt identified two formatting errors;
the corrected attempt is retained separately.

This repair preserves the original hosted failure evidence. The hosted JVM
shutdown failure and its acceptance gate remain open under #1454/#1427.
