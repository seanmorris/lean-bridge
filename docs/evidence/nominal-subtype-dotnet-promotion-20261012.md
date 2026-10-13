# Installed C# nominal Subtype support

Predecessor: `ad838834ca234ac7715462df368c28ca0d1cede1`.

The support inventory now includes the [four original C# selections](nominal-subtype-dotnet-20261012.md):
ordinary-source and reviewed packages, each with full and result-only APIs.
Their producer remains `5762111059313672f23825b65df2f91ec05437a3`.
No successful compiled producer was rerun for this documentation milestone.

Those packages reproduced in two author directories and ran after offline
NuGet installation, relocation and removal of consumer sources. Twelve
executions completed 37,884 checks, 6,192 native refusals, 48 managed-input
refusals and 96 independent snapshot controls. The tools were .NET SDK 8.0.424
and shared framework 8.0.30 on Linux x64/glibc 2.36, with an explicit 2.36
package floor. The complete SDK and framework remain trusted tools.

## Support and documentation

Four evidence entries supplement the existing ordinary/reviewed parameter and
result cells and add two field observations. The inventory contains 500
evidence entries and 585 observations. This changes six C# support cells only.
Earlier claims and archive bytes remain intact; exact source transitions record
updated current-file identities.

Generated C# records and sealed cases carry exact `BigInteger` payloads for the
tested `Nat` Subtype fields. Each input site retains its selected constructor,
including different normalizing choices for the same record. Copied results
project the values Lean already constructed and need no input constructors.
The consumer guide includes a named `Program.cs` example. Both author guides
and the generated conversion reference distinguish the completed C# acceptance
from pending host and type combinations.

The [required C# CI gate](nominal-subtype-dotnet-ci-20261012.md) was committed
separately. Its [hosted execution at this milestone's predecessor](https://github.com/seanmorris/lean-bridge/actions/runs/38249924226/job/114813264442)
passed on 12 October, including the nominal-package gate and original-record
upload. This promotion cites the independently authenticated local archive;
it does not substitute that job status for an audit of the hosted artifacts.
Other primitive bases, refined callbacks, owned values, recursive, dependent
and broader generic Subtypes remain within #1444. Constructor/source entry
counts and memory remain unmeasured by these C# selections.

## Documentation CI correction

[Job 114813264186](https://github.com/seanmorris/lean-bridge/actions/runs/38249924226/job/114813264186)
failed because two documentation assertions required an artifact list without
the new `php-wasm-generated-failure-*/` directory. The workflow already uploads
that directory to retain failing probes. The corrected assertions require the
new directory and every earlier artifact. The workflow itself is unchanged.

The same assertion failed locally before correction: one test, one failure,
zero skips. Original TAP SHA256:
`16495f991cc06be58875d9e41ba25b40d00c2082c741242f331e22bac0d3f64f`.
Original hosted log SHA256:
`27ed8ffb75a32fae6e4f230c37fd4d198b370655635ec1b2a6cc2f47678a4a6c`.

The separate WIT receiver job failed during toolchain bootstrap after six HTTP
504 responses, before its acceptance tests. Its original log is retained under
`build/vo1220-ad83883-failure-114813264203.log`, SHA256
`901ec3dcddaa3e5107e3b1376ad5e4f702347b67eded9609c26942eca029e548`.
This milestone does not change that download path or claim WIT acceptance.

Core CI also exposed two historical workflow comparisons that omitted the
later C# and PHP-Wasm transitions. Both failed locally before correction. The
tests now check the live gates and use the existing digest-authenticated
history to compare their exact predecessors. All four Python/Ruby workflow
checks pass, including their unchanged refusal controls. Original failed TAP
SHA256: `3526a040ac6b873181b706e0b0342de8ee9a0da1d8de308e78dce304ee4dbb2d`.
Corrected TAP SHA256:
`3f27db9a066dd929cb76a5f02ff169496788f80ec802d46e508ad4afc01a2f49`.

The first seven-root regression reported 496 passes, three failures and 78
explicitly gated skips. Two failures reproduce those workflow comparisons;
the third was a support-count assertion that omitted the newly accepted C#
field position. The corrected count still checks every observation's evidence
and leaves unaccepted positions unavailable. Original TAP SHA256:
`0da097d01697a8d66128299add441c1d25cb7b30b5b72c36d77028198f2c93b9`.

## Verification

The focused promotion/history suite passed 48 tests with no failures or skips,
including the earlier npm, C/C++, Perl, Python, Ruby and Rust promotions and the
PHP-Wasm/JVM diagnostic histories. TAP SHA256:
`54e35e520dbb59a7eec7f97647b43626bdf78c1d88d1e2f83734face33d62eb9`.

After the workflow and support-count corrections, the expanded focused suite
passed all 52 tests with no failures or skips. TAP SHA256:
`99018ed76f5507239e92beca4339506274eec0e62956039dea8a01a629914d7f`.
Full lint, checked JavaScript and all 16 contract-backed reference pages pass.
The complete documentation suite passed 43 tests with no failures or skips.
TAP SHA256: `d7a08c7f3d977afdf166c75cdd25c524dac357207c1f81edef7a1010ff41142e`.

The final seven-root regression passed 499 tests with zero failures and 78
explicitly gated compiler/installed skips. Its 577 tests cover the component
refinement mirrors, checked records, native Subtypes, support inventory,
conversion documentation, test registration and checked JavaScript. It finished
on 13 October at 09:59 UTC. TAP SHA256:
`0a08f205f43bbb77543709114b0b7382a7515de14dd8f73e5100bf841eec263c`.
The four separately archived installed C# selections had no skips; these
default-gated regression cases do not replace their acceptance.

The [immutable source ledger](nominal-subtype-dotnet-promotion-source-history-20261012.json)
records 29 exact transitions and 177 refreshed current-source pins. Ledger
SHA256: `7826f83aa5122d0f51ec3d0822151cf3458fcb10880593e36fb215cc78b1950b`.
The independent audit reconstructs every predecessor file from Git, checks all
earlier evidence claims and unrelated observations, and authenticates all 358
original archive members plus their index. The workflow is byte-identical to
the predecessor. No prior archive or source ledger is rewritten.
