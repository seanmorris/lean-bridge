# Native Fin edge installer: .NET SDK selection

[Managed consumer job 114211587293](https://github.com/seanmorris/lean-bridge/actions/runs/38051564992/job/114211587293)
failed before executing the installed edge-case consumer. The installer required
exactly one stable .NET 8 SDK, but the hosted runner reported five. The retained
job log, `build/vo1220-dotnet-b8765be-114211587293.log`, has SHA-256
`68ac2dd2169b82a12404ce85a940f4e4c8c2b4621a73966500c8e3c352fb8225`.

The installer now chooses the highest installed stable `8.0` SDK version from
the explicitly selected host's canonical SDK directory. Other major versions
and prereleases cannot win selection. Missing SDKs, duplicate versions, foreign
directories and unsafe numeric versions fail selection. The installer writes
the exact version to `global.json`, disables roll-forward and prereleases, then
requires `dotnet --version` to match before restore.

Archive, receipt, package-cache, build-input, deployed-file and host-integrity
checks remain in place. The fix changes no runtime ABI or support claim.

## Local verification

Synthetic selection tests reproduce the five-SDK condition, vary ordering and
line endings, and check numeric version ordering. A fake host returning the
wrong version after reading its SDK listing fails before restore or MSBuild.
That control uses a real generated NuGet archive; it is not installed Fin
acceptance.

The frozen source rerun passed 17 tests with no failures or skips, including the
real .NET compiler/loader guards and a compiled Lean source fixture with 14,089
assertions and 12,047 measured public calls. Its selected implementation/probe
files remained unchanged. It kept at least 1,034 MiB free and did not trigger the
768 MiB stop floor. The runtime checks use local SDK 8.0.424; hosted multi-SDK
execution still requires CI.

The successful TAP, `build/vo1454-dotnet-sdk-source-r2.tap`, has SHA-256
`365e5dace3811e387c8a4e7921118288c92cc7c49f96eb95a1cbcc32c5766316`.
The end record hashes to
`4d3dcb080ab47b29bdc96af586bf9dbe323dd4634da2b639e773d816c0c0aa98`.
This source fixture uses a synthetic receipt and does not replace two-root,
source-free installed-package acceptance.

The four-root integration run passed 162 tests with no failures and thirteen
explicitly gated skips. Its TAP SHA-256 is
`dba5a93236cf065d97f5bbdedb7b71818ab763ada042cea8133a2f29efb093f1`.
Final focused selection/history checks passed six tests with no failures and
one runtime-gated skip, already executed by the frozen source rerun. Their TAP
SHA-256 is `ccf747e1782cd3fdb709c6fa8347d3ff7bcfcf4ca57664de9bc9094bdc2a2f8f`.

The first source run passed its 17 tests, but its wrapper rejected the source
snapshot because test registration changed during execution. That run is not
the frozen result above. Its original TAP and end record remain at
`build/vo1454-dotnet-sdk-source-r1.tap` and
`build/vo1454-dotnet-sdk-source-r1-end.json`. Their SHA-256 values are
`98e8354542a9e7f22d3971b722ffe9aad0f95429cd58c74718b9c348b0b62faa`
and `bdac9121f6b65277fd60c296d2eaa2c05d6a513c6136e49bea8e7695fce4bb99`.
The first full lint run found one brace-formatting error in a new history test.
After that correction, full lint, checked JavaScript and all sixteen generated
reference checks passed.

## Evidence preservation

The [source ledger](fin-dotnet-sdk-source-history-20261010.json) records eight
transitions from `1d9b17a4f295566f77fd1d8e5bf898c49c1fea54`. Its SHA-256 is
`e1589698e97e00d01d1c72702a04ceb360693b5244d11086f3bcfd56811b6e72`.
An independent Git audit verified all predecessors, six current-source hash
updates, unchanged support claims and unchanged older evidence files. The
inventory still contains 407 evidence entries and 509 observations. The audit
log SHA-256 is `4bafc21267786ebf57d99034e0c8a5c47e19453fbf377c7dda3f6ea18debecb9`.

The installed .NET edge gate and hosted CI remain separate acceptance steps.
The JVM edge job also failed at debugger shutdown; SDK selection does not fix
that failure. Tasks #1454, #1427 and #1220 remain open.
