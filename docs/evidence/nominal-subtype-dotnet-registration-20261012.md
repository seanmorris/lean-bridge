# Nominal C# Subtype harness registration

This milestone adds an independent C# caller, NuGet inspector, typed API probe,
and ordinary/reviewed full/result-only installed selections. No compiled nominal
NuGet selection has run yet. The support inventory remains at 496 evidence
entries and 583 observations.

The caller reads `BigInteger` bytes and public record, variant, option, result
and tuple fields directly. Generated equality and serialization do not determine
expected results. It checks per-use normalization, aliases, active branches,
100-bit results, exact native rejection paths, Fin-before-Subtype ordering and
complete unchanged inputs. The full API runs 1,000 rejection/recovery rounds;
the result-only API runs 1,000 repeated wide record results.

Each full execution requires 4,226 checks, 1,032 native rejections, seven managed
input rejections and eight snapshot controls. Result-only executions require
2,088 checks, one managed input rejection and eight snapshot controls. The managed
cases cover negative Nat values, null references and uninitialized Result values.
The synthetic control API supplies dishonest equality implementations. The caller
rejects all 56 injected value, constructor, mutation and diagnostic faults across
the four selections. These controls are not installed-package evidence.

The producer reuses the existing closed NuGet installer. Original archive bytes
determine the package cache, restore inputs and supplied deployed files. Separate
checks bind package sources, managed assembly identities and native loader hashes
to the reproduced compiler model. Both author roots must produce identical
archives and receipts, and both are removed before offline installation. The
caller runs installed, after physical relocation, and after removing the consumer
sources, package cache, local feed, probe project and temporary handoff.

The API probe compiles against the verified deployed assembly in a separate
project. All 13 input methods and the input-only Pair type must compile in full
packages. Result-only builds must produce exactly the corresponding CS0117 and
CS0246 diagnostics, at the expected source locations. The harness retains original
compiler stdout, stderr, SARIF, source and referenced assembly. Twenty-seven altered
compiler-record controls verify those checks.

The selected .NET host is canonicalized and hashed; actual SDK and runtime
listings are retained. Each deployed caller separately reports its executing
framework, architecture and runtime directory. SDK and shared framework contents
remain trusted toolchains. The old installer exposes input/build-input/output
identities, not restore/build stdout; this harness does not fabricate those logs.
Constructor/source entry counts and memory measurements are not claimed.

Original package handoffs and records are retained under build/ before successful
temporary roots are removed. Failed roots remain available for investigation.
Installed tests require an explicit gate and native glibc floor. Local producers
use one CPU at nice 19, check resource headroom before each build and monitor disk
and memory during execution.

## Validation

The immutable registration ledger records three exact transitions from
`8e55991afe355068b22b227d5e50446d2f229be5`. Its SHA-256 is
`549cba70852568169c98482a0637d7499f15de8fee6d11b4a7490495aba4b13f`.
An independent audit reverses those edits against Git and confirms that all
earlier tracked evidence and the support inventory remain unchanged:
`build/vo1444-nominal-dotnet-harness-audit-r1.json`, SHA-256
`e32d529407f141e03ed51ead0a9f48f9f9c2e71dea411c59da8d67a12d70cede`.

Focused harness and existing NuGet closure checks: ten passed, zero failed,
ten explicitly gated skips. Original log:
`build/vo1444-nominal-dotnet-harness-focused-r1.log`, SHA-256
`f977f02e89a3bf49f55c42b3dd2f885f5989971daf97218e3137e4c5c3260e99`.

Registered component-refinement, checked-JavaScript and test-registration roots:
176 passed, zero failed, 29 explicitly gated skips. Original log:
`build/vo1444-nominal-dotnet-harness-registered-r1.log`, SHA-256
`82cccb5c304129242259168d49e447a9dbdde9187e92166a9c7e2eee5cb41256`.
Full repository ESLint and the repository JavaScript typecheck passed. Sequential
commands and terminal results are retained in
`build/vo1444-nominal-dotnet-harness-verification-r1.json`.

The final probe check also requires a nonempty emitted assembly with a complete
identity and rejects extra output names. The final focused rerun passed nine
tests, zero failures and four gated installed selections, including all 27
compiler-record controls. Original log:
`build/vo1444-nominal-dotnet-harness-focused-r2.log`, SHA-256
`aa7c1e0e5d50d4723f88abcd43a8fedb58448cfc8967e02092399e06d8c0a826`.
The two tightened modules also pass a separate ESLint rerun.

Four real compiled selections, independent archival verification, support/docs
promotion and required recurring CI remain for nominal C# acceptance. The broader
requirements of #1444 and #1220 remain open.
