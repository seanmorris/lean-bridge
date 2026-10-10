# Native generic-record rollout: hosted acceptance

[Downstream run 37969725049](https://github.com/seanmorris/lean-bridge/actions/runs/37969725049)
passed all 46 jobs at `ff71335c762628da47887bfd4f208e62c39b94b7`.
[Core quality](https://github.com/seanmorris/lean-bridge/actions/runs/37969723940)
and [performance evidence](https://github.com/seanmorris/lean-bridge/actions/runs/37969723919)
also passed at that revision. The hosted audit completes VO #1439.

The [archive receipt](generic-record-array-hosted-20261010/receipt.json) pins
150 files: original GitHub artifact ZIPs, job logs and metadata, report bytes,
and 57 producer-source snapshots. Its SHA-256 is
`bf6d8306150d051ae1b9e02926b19c5cbefc14cad553e080a86cacc66b95ebc0`.
The audit verifies each ZIP against GitHub's artifact digest and each selected
report against its ZIP member. It reconstructs the executed consumers from
the retained Git sources.

## Executed coverage

| Consumer | Array checks per execution | Runtime selection |
| --- | ---: | --- |
| C | 2,078 | Hosted C-family job |
| C++ | 2,058 | Hosted C-family job |
| Python | 2,144 | 3.11.17 and 3.12.15, separately |
| Rust | 2,034 | Hosted Rust job |
| Ruby | 2,141 | Hosted Ruby job |
| C# | 2,088 | Hosted .NET job |
| Java | 2,105 | Hosted JVM job |
| Kotlin | 2,067 | Hosted JVM job |
| Native PHP | 2,124 | Hosted native-PHP job |
| WIT/WASI | 2,091 | Hosted WIT job |
| Perl | 2,145 | 5.36.3 and 5.38.2, each threaded and unthreaded |

Twelve jobs produced thirteen Array reports and fifteen language/runtime
observations. Each Array test suite passed all twelve tests without skips.
The archive also retains each job's direct-record and nine-specialization
reports: 39 generic-record reports and 45 observations in total.

Each selection reproduced its package archives from two author roots, removed
author and build inputs before offline installation, and called the generated
public APIs with a compiler-free consumer PATH. The Array consumers preserve
the original direct exports, List/Option cases, separate namespaces, explicit
universes and phantom nominal arguments. Invalid-member checks include recovery
and 1,000 Array rounds. Rust and managed-language reports retain caller-specific
compiler rejections, followed by successful execution of the valid consumer.

The jobs ran on `ubuntu-24.04`, image `20261004.327.1`, with the configured
distribution floor and no local glibc override. Python reports identify both
interpreters and the `manylinux_2_38` wheels. Perl logs select each pinned
interpreter; the companion ABI artifacts record glibc floor 2.38 and runtime
identities matching the Array packages. These runs do not measure execution
on a machine running the minimum supported libc version.

## Verify the archive

From the repository root:

```sh
node --test tests/generic-record-array-ci.test.mjs
```

The registered CI test checks the archive alongside the recurring workflow
commands. Negative controls reject altered receipts before reading their paths,
missing or corrupt originals, incomplete case coverage, changed consumers,
wrong runtime selections, local-floor overrides and failed or skipped executions.

The ZIPs retain GitHub's evidence artifacts, not the built consumer packages.
Package archives and complete model/receipt documents remain identified by
the original report digests. The 57 snapshots cover the selected producers,
fixtures, consumers and workflows, not the complete build dependency closure.

The [local acceptance archives](generic-record-array-rollout-20261009.md),
including the initial failed Perl attempt, remain unchanged. Existing support
states remain unchanged. This closure covers ordinary-source native generic
records; it does not close #1426 or #1220, or add reviewed-IR, browser,
PHP-Wasm, inherited, indexed or refined generic-record coverage. The separate
[finite-specialization closure audit](native-specialization-closure-20261010.md)
now reconciles the original #1426 requirements, including the common function
fixture and Lean-selected instances, and completes that task.
