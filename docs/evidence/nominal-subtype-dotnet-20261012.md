# Nominal C# Subtype installed acceptance

Four NuGet selections passed at producer
`5762111059313672f23825b65df2f91ec05437a3`: ordinary/full, reviewed/full,
ordinary/result-only and reviewed/result-only. Each package reproduced exactly in
two independent author directories. After removing the author inputs, the C#
caller ran against an offline installation, a physically relocated installation
and a source-free deployment containing only the original output files.

The twelve executions completed 37,884 checks, 6,192 expected native rejections,
48 managed-input rejections and 96 independent snapshot controls. The caller
checks exact BigInteger values, constructor-specific normalization, Fin error
ordering, record fields, variant branches, aliases and nested containers. Its
length-delimited snapshots do not use generated equality or serialization.
Full runs include 1,000 rejection/recovery rounds; result-only runs include 1,000
wide-result rounds.

Actual tools: .NET SDK 8.0.424 and shared framework 8.0.30, Linux x64, glibc 2.36.
The package declares glibc 2.36. Separate invocations of the compiled caller
report the framework that actually executes each deployment, with identities
for `libcoreclr.so` and `System.Private.CoreLib.dll`. The selected host binary is
also identified. The complete SDK and shared framework remain trusted tools.

The typed API probe compiles against the verified deployed managed assembly.
Full packages expose thirteen checked-input methods and `Pair`. Result-only
packages reject those references with thirteen CS0117 errors and one CS0246
error, at the expected source locations. Result-only outputs do not require an
input constructor.

## Original records

The adjacent archive contains 359 files totaling 7,594,689 bytes. It preserves
298 original selection records, all four original start/end/TAP records, the
monitored runner, 37 frozen Git sources and ten independent checker modules.
Those sources include the complete eighteen-module managed generator closure.
Managed caller, probe and referenced-library bytes are retained with their
original file identities. Native package binaries remain identified by the
original package and runtime receipts; the full nupkg handoffs remain under
`build/vo1444-nominal-dotnet-*-5762111-records`.

The checker reads archived relative paths and frozen Git sources. Recorded
absolute paths describe the original runs; it never reopens them. It checks
per-use constructor decisions, all package text, generated C# sources, managed
assembly identity, native loader identities, the closed NuGet cache, restore
inputs, dependency graph, deployed outputs and all three execution stages.
The original verified nupkg bytes supply the independent SHA-512 values used by
the NuGet cache and dependency records.

The existing closed installer retains original input, build-input and output
identities. It does not expose restore/build stdout; no substitute logs are
created. The separate typed probe retains its actual compiler process outputs
and SARIF diagnostics.

Archive index SHA-256:
`57f0400fec21849c9e29be1a98029a20808bfd3c9532a904370444d9c7b1cb38`.

Independent audit `build/vo1444-nominal-dotnet-archive-audit-r1.json`, SHA-256
`408cc5c887d8535d9ac8b3e525b4b34098ac9eb27413bb3cc06722b803cb8af8`,
compares all retained records with the original runs, frozen sources with Git,
and archived checkers with the current modules. It confirms unchanged earlier
evidence and support inventory. The only existing source change registers the
archive tests; that file has no earlier evidence pin or history transition.

## Checks

- 718 missing/corrupted archive-file controls.
- 92 coordinated provenance controls, including substituted tools, skipped or
  incomplete TAP and resource-stop records.
- 866 required-record and coordinated semantic controls. These include
  re-signed build imports, dependency graphs and deployment records; changed
  compiler diagnostics, managed sources, constructor choices, framework
  identities and public results.
- Focused suite: 23 passed, zero failed, four explicitly gated installed-run
  skips. Log `build/vo1444-nominal-dotnet-archive-focused-r1.log`, SHA-256
  `cbfe748820f6eae0da2c0e24a912a5366b11c1966520aab0172e91618b336500`.
- Registered entry-point selection: all four archive tests passed, no failures
  or skips. This selects the archive tests through
  `tests/component-refinement-mirrors.test.mjs`; it does not claim a complete
  rerun of that root. Log
  `build/vo1444-nominal-dotnet-archive-registered-r1.log`, SHA-256
  `da20e7c276412bdfe4ec4f599aa9e94ecbca2ebaa5f6efa96f8c3c5102f55881`.
- Full-repository ESLint, checked JavaScript and `git diff --check` passed.
  Serial verification record:
  `build/vo1444-nominal-dotnet-archive-verification-r1.json`.

The earlier successful compiled runs were not repeated. The original first
ordinary/full attempt at `77f3208` stopped on high host load after its first
author build. Its failure records remain intact. The successful runs use the
bounded resource-wait policy committed in `5762111`.

## Remaining work

Required recurring C# CI and support/documentation promotion follow this
archive. The support inventory remains unchanged at 496 evidence entries and
583 observations. This acceptance covers the concrete Nat-payload nominal
fixture with Fin fields, not other primitive bases, callbacks, owned, recursive,
dependent or broader generic Subtypes. Constructor/source entry counters were
not measured. The remaining #1444, #1443 and #1446 requirements remain open.
