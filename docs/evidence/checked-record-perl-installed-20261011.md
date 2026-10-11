# Installed Perl checked records, 11 October 2026

All four source routes passed actual installed CPAN acceptance on Perl 5.36.3
and 5.38.2, each threaded and unthreaded, using both `prebuilt-only` and
`build-xs`. Each route reproduced the complete four-ABI archives from two
independent author roots, removed the author/build directories, installed
offline, executed without the Lean compiler, moved the complete installation,
and replayed the unchanged consumer. Installed bytes remained unchanged.

| Route | Producer revision | Checks per execution | Original TAP |
| --- | --- | ---: | --- |
| Ordinary source | `0f0baca890a48ae2a0e1170746a39c1e13f3c5f4` | 9,024 | [TAP](checked-record-perl-installed-20261011/ordinary-source/run.tap) |
| Reviewed IR | `761ffefc9d3c5bdf8cadcc30018ed1c74584400a` | 9,024 | [TAP](checked-record-perl-installed-20261011/reviewed-ir/run.tap) |
| Ordinary result-only | `761ffefc9d3c5bdf8cadcc30018ed1c74584400a` | 1,002 | [TAP](checked-record-perl-installed-20261011/result-only-ordinary-source/run.tap) |
| Reviewed result-only | `761ffefc9d3c5bdf8cadcc30018ed1c74584400a` | 1,002 | [TAP](checked-record-perl-installed-20261011/result-only-reviewed-ir/run.tap) |

Every route has eight interpreter/install-mode combinations and exactly one
passing installed test, with no failed or skipped tests. The full consumers
exercise per-parameter constructor rejection, late-argument errors, caller
input preservation, constructor normalization, 100-bit values, proof-erased
results, fresh result objects, and 1,000 rejection/recovery cycles. Result-only
packages independently exercise output mirror registration without a checked
input declaration.

`build-xs` compiles only the generated XS wrapper with the consumer's C compiler.
`prebuilt-only` uses the prepared wrapper. Neither installation mode recompiles
Lean. These local packages declare glibc 2.36; they do not establish the hosted
glibc 2.38 acceptance requirement. No source or adapter entry counters were
measured in these Perl runs.

## Retained originals

[The archive index](checked-record-perl-installed-20261011/index.json) has SHA-256
`171f18d750b99629387f84ec49f284dc7136199256263157fecf274ce0c17c50`.
It authenticates 489 artifacts: original reports, TAP and queue logs, run
metadata, both author models and receipts, all installed manifests and
installation traces, actual stdout from both retained executions, callers,
generated XS, the run and mutation-check scripts, and 27 selected Git source
snapshots. Those selected sources are identical at both producer revisions.
The archive retains package hashes and installed-file inventories, not package
binaries or a complete toolchain closure. Absolute paths in original metadata
record the producer environment; archive checks never open those paths.

Each route's independent record checker accepted the original records and
rejected 37 altered-report controls. Recurring archive tests additionally check
every original file for omission, size changes and same-size corruption, and
repeat semantic rejection checks without relying on the archive digest.
The failed first producer and the narrower identity diagnostics remain in
[the identity-repair archive](checked-record-perl-identity-repair-20261011/index.json).
The successful runs do not replace those earlier records.

## Recheck

```sh
node --test tests/helpers/checked-record-perl-archive-tests.mjs
node scripts/check-checked-record-perl-reports.mjs \
  --route reviewed-ir \
  --directory docs/evidence/checked-record-perl-installed-20261011/reviewed-ir \
  --tap docs/evidence/checked-record-perl-installed-20261011/reviewed-ir/run.tap \
  --glibc 2.36
```

The tests are imported by the registered `tests/checked-records.test.mjs` root
through its Perl installed-source checks. This milestone preserves the current
support inventory unchanged. Support-table promotion and a required hosted
four-route installed gate remain separate work, as do browser/PHP-Wasm and
broader nested, dependent, recursive, callback and owned checked records.

Verification before commit: archive checks 4 passed, no failures or skips;
registered checked-record, native-product and test-registration regression
113 passed, no failures, 28 explicit compiler/installed gates skipped. The four
fresh installed runs above have no skipped tests. Typecheck, targeted lint and
all 16 generated-reference checks passed. The regression TAP has SHA-256
`3860d9b5159d38d350a73882a976f9e37eb7bf31271dd6a66c30034ebef229b9`.
All 6,558 earlier evidence files and the support inventory remain unchanged.
Original generated XS whitespace is retained because its bytes are authenticated;
it is not reformatted as part of the archive.
