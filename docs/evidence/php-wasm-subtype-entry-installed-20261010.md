# Installed PHP-Wasm Subtype entry probes

Producer `7f3ae5573d224153ce9f182f13833760d7196301` passed both ordinary and
independently reviewed installed gates. Each route reproduced its package
archives from two author directories, deleted those directories, and installed
the handed-off npm and Composer archives offline with compilers unavailable.

Each route ran twelve Node/Chromium configurations. The harness executed every
configuration twice and required identical results and unchanged deployment
files. Every run completed the original 2,024 PHP assertions and recorded the
exact sequence of 2,030 public calls, including 1,000 rejection/recovery pairs.
A separate unrefined call supplied a nonzero adapter/source control.

Per complete corpus, the trace contains 2,029 validator entries, 3,045 constructor
entries, 1,017 adapter entries and 1,016 source-function entries. All seven chosen
constructors execute. Odd-value and late-string rejection stop before the
adapter/source; the invalid Fin precheck records no constructor, validator,
adapter or source entry. The generic echo measurement observes its reduced
worker. `zeroEven` is a constant and has no claimed per-call source-function entry.

These are separately instrumented packages. The build records original C inputs,
reversible marker insertions, compiler arguments, object hashes and the linked
Wasm hash. The report checker ties that hash to the installed component and checks
the complete trace against independent call expectations. The original release
driver still requires empty stderr.

## Original records

The [archive index](php-wasm-subtype-entry-installed-20261010/index.json)
authenticates 109 files, including the two reports, all four builds' C inputs,
runner records and 30 producer sources independently matched to Git. Its SHA-256
is `08afa6ca8e2e68fb8461c62e6834f6388b95482d700c5f901617fa47458c6939`.
Recorded absolute paths identify the original run. Readers use archive-relative
paths and do not require those original directories.

- Ordinary report: `3116b66a25dc17ffd56e093927b88cde6add6dfb864a36e172514ab413008718`.
- Reviewed report: `33c59703dce40760f9ba437039b2604b34067cdff7898a6df4e546ba96faa1a0`.
- Original TAP: `0c77eea6f1d4e46aacf439d294e2a0125619a9a37dd72f942cfcdc5d5f5ad57c`.
  Two passed, zero failed, zero skipped, 348.8 seconds.
- Disk monitor: minimum 1,784 MiB free; no disk stop.

The archive contains selected producer sources, not a complete toolchain/input
closure. The original producer removed package binaries and object files after
recording their hashes. No registry publication occurred.

## Independent checks

Run the portable paired checker on the archive or a fresh report directory:

```sh
node scripts/check-php-wasm-subtype-entry-reports.mjs \
  --directory docs/evidence/php-wasm-subtype-entry-installed-20261010/r1
```

The registered regression tests verify both original reports, 62 malformed-report
cases, both corruption forms for the index and all 109 archive records, and CLI
argument/missing-route failures. They reject altered constructors, missing
instrumentation or positive controls, incomplete browser coverage, changed
compiler inputs and modified locks or package identities.

The first corruption-control run exposed excessive memory use in Node's assertion
diff formatter. Its original [failed TAP](php-wasm-entry-checker-controls-20261010/r1.tap)
is retained unchanged. The process reached about 10 GiB resident memory and was
stopped. The checker now compares full traces using strict deep equality with a
bounded diagnostic. The [corrected run](php-wasm-entry-checker-controls-20261010/r2.tap)
passed all four test groups in 15.9 seconds with a 1 GiB heap limit, SHA-256
`73bf9fbf2327f95e1ec2bc2cb1b1bfa3e8e948464466ceabafd5c28f94bcfab0`.
The installed producer and its original reports did not change.

The [Git audit](php-wasm-entry-checker-controls-20261010/audit.json) verifies all
109 original records, all 30 selected producer sources and 5,275 older evidence
files. The support inventory is byte-identical to the producer's inventory.
The only existing source edit registers the new report tests. No earlier support
claim or source-history ledger changed.

The affected four-root regression passed 198 tests with zero failures and 15
explicit compiler/installed skips. Its TAP is
`build/vo1443-entry-acceptance-integration-r1.tap`, SHA-256
`b6669383a904da963c443e287126b7286a08345df1a86a0939c4bc6fe8b016db`.
Full lint, checked JavaScript and all 16 generated reference pages passed.
The actual installed probe gates ran separately above with no skips.

## Remaining work

Add the actual installed probe command, paired checker and original-artifact
uploads to CI. Hosted acceptance is still owed. This milestone does not close
#1443, #1444 or #1220 or remove their remaining native/browser, nested, nominal,
graph, owned, callback and dependent-type requirements.
