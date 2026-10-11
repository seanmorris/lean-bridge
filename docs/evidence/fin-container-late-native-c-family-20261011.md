# Installed C/C++ late-input acceptance

The installed producer at `5c5d7c67bc0a2fb5bad177ad9ca683b75d812d96`
passed one test with zero failures or skips. C executed 21,186 assertions and
C++ executed 20,162, before and after moving each complete installation.
The two author builds reproduced the package archives. Each author was removed
before its package was used; the second build followed the first installation
and replay. This run does not measure dispatch counters.

Original records:

- Prefix: `build/vo1454-late-native-c-family-r1-5c5d7c6`.
- TAP SHA-256:
  `132f862a10c330d188789e84b2a98e48ae1de2d802ec4da32764e756c22ce3cd`.
- Report SHA-256:
  `805cfecab69f63e06e51ac0d27781c846899334b1bb72bcde5210c73e98b4add`.
- The report's adjacent `.records` directory retains 19 original files.
- Minimum sampled free disk: 1,559 MiB. The 768 MiB stop guard did not trigger.

The wrapper exited unsuccessfully after the installed producer passed. Its first
report checker incorrectly required `sourceIdentity` directly in the C/C++
receipt. `src/release/native-c-family.mjs` records the complete packaged model
in `files["share/lean-bridge/component/model.json"]` instead. The corrected
checker requires that file's byte count and digest to match the retained author
model, and also checks both component and adapter receipt digests against their
packaged file entries. Other hosts retain their direct source-identity check.
Production packages, consumer code and original execution records did not change.
The successful producer was not rerun.

The actual report passes the corrected CLI. All 92 report/file corruption and
weakened-claim controls are refused. The original failed checker output remains
in `build/vo1454-late-native-c-family-r1.queue.log`; the corrected result is
`build/vo1454-late-native-c-family-check-r2.log`.

Regression: 87 passed, zero failed, 22 explicit compiler/installed gates skipped.
TAP `build/vo1454-late-native-checker-fix-regression-r1.tap` has SHA-256
`e3bbf04ac67f17a88c3abc2dc62f5f6001938272342bb4c51bb2caf1c7139ec0`.
Targeted lint, checked JavaScript and ShellCheck pass. Added synthetic C-family
controls cover missing or changed packaged-model identity and changed component
or adapter identities.

`scripts/run-fin-late-native-ci.sh` is prepared for eight CI selections covering
all nine native profiles and both Python minors. Its registered shell tests
check selection, exact command arguments, original TAP retention, producer and
checker failures, stale output refusal and the hosted glibc floor. The script
is not yet invoked by the workflows. WIT/WASI retains its separate supplement.

Installed acceptance for the remaining hosts, immutable archival of the actual
runs, workflow integration and the original-case closure audit remain pending.
No support cell or VO task is closed by this milestone.
