# Core regression repair

Core run `38051564735` failed at `b8765be7c642fd7ba3349c8cc90a3857a7118b26`. Replaying its ten failed tests against `4e0291810246eb3c22061bf00a5508e0490adc1a` produced one pass and nine failures. The hosted-promotion expectation had already been repaired; the remaining failures were reproduced locally before this change.

## Corrections

- Historical fixture and container checks now reconstruct registered source transitions to the exact recorded digest. They still reject unknown edits and preserve unchanged binary buffers.
- The native CI mock supplies both Python 3.11 and Python 3.12 setup outputs. Actual Bash recording checks require the correct executable in each selected command and reject unknown outputs.
- Java and Kotlin documentation tests require the completed hosted product/field evidence and retain the callback rejection.
- The authoritative inventory restores `undef` and generated `Some->new(value)` guidance in four Perl Fin conversion notes. The generated consumer table uses those notes.

The [source-history ledger](fin-core-repair-source-history-20261010.json) records 13 exact transitions from `4e0291810246eb3c22061bf00a5508e0490adc1a`. Independent comparison with Git authenticated every predecessor. Its SHA-256 is `96be754959edb58f5c9085bf78530902ecd837246fb5a9c2d248c212804e02e4`. The inventory changes 79 source pins and four conversion notes. Its 401 evidence entries, 507 observations, acceptance states and evidence claims are otherwise unchanged. Earlier ledgers and execution reports remain byte-identical.

## Local verification

The ten previously failing checks and seven added regression checks pass with no skips. The twelve-root integration run passes 228 tests, with zero failures and six explicit installed/compiler gates. Full lint, checked JavaScript and all 16 generated-reference checks pass.

Retained local logs:

| Log | SHA-256 |
| --- | --- |
| `build/vo1220-core-b8765be-local-repro-r1.tap` | `0b0ab3a7bfafc641f216d931951be850408e6f1bea25ff51181ea35f839372bc` |
| `build/vo1220-core-repair-r1.tap` | `8779b4237ab129a5fc3579f38a87bb135a9d3a4bc6bfb4deed628e24e06f9332` |
| `build/vo1220-core-repair-integration-r1.tap` | `3f876b7197f20c9f47d9b88bef877d53b0184d262a07f3b07f970dfa6b50cc49` |

These checks repair the reproduced Core failures. They do not establish a complete Core pass, hosted acceptance, or resolution of the separate JVM/GDB normal-exit failure.
