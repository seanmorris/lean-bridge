# Installed .NET Fin edge acceptance after SDK repair

Producer `7b575976b7804fa99e10d71cf10b21468def33d3` passed the two-root,
source-free installed .NET edge gate after the [SDK selection repair](fin-dotnet-sdk-20261010.md).
The packages reproduced across both author roots. Execution used the relocated
prepared package after deleting the author/build root, with offline installation
and package, host, class-library and deployed-file checks enabled.

The report records 14,089 public assertions, 12,047 measured C# calls, 42 raw
adapter observation rows and 12,077 separate C foreign-carrier probe calls. Its
measurement sections name the exact adapters and source functions observed;
unmeasured source functions remain listed explicitly. The foreign-carrier probe
does not stand in for the C# consumer.

Local tools were .NET SDK 8.0.424 and Debian GDB 13.1. The package used the local
glibc 2.36 floor. This run does not establish hosted execution with multiple SDKs,
other operating systems, or the separate JVM debugger repair.

## Original records

The [archive index](fin-dotnet-sdk-installed-20261010/index.json) authenticates
29 files: six successful-run records, four records from the failed report-name
attempt and nineteen selected producer sources. The sources match Git at the
producer revision. This is not a complete source/toolchain archive. The fixture
cleaned its package binaries; the original report retains their digests and
installed identities.

The index SHA-256 is
`e7baed125df3ba3d800e62fc61e1eb25359ddc03f23bde640adcbf035eb74a9b`.
The [report](fin-dotnet-sdk-installed-20261010/report.json) hashes to
`e0cd49c8746265e9ee4a71c1661e75944a9f3ee8a93e1695e1f1dcd29231ec49`.
The [TAP](fin-dotnet-sdk-installed-20261010/run.tap) records one passed installed
gate with no failures or skips in 253 seconds. Its hash is
`665ce62f8fdeaaa4d964f23a07602eb24d9e5c3216fc37c052c21850685e23f9`.
The run kept at least 899 MiB free and did not trigger its 768 MiB stop floor.

The first attempt stopped before compilation because the task-local runner's
report name lacked the required `edges-` prefix. The corrected runner used a new
destination and preserved the original failed log, source revision and report
validation. Neither attempt replaced another report.

The existing foreign-report checker accepts the archived report. An independent
archive audit matches all nineteen sources to Git, verifies all 29 file digests,
rejects appended and same-length altered bytes for each file, and rejects seven
report mutations affecting counts, measurements, reproduction or source removal.
The audit log `build/vo1454-dotnet-sdk-installed-archive-check-r3.log` hashes to
`a68ebce78354d83b42b7c613ebdbe2368309e21f4c4e9b2df1237c9f166ff727`.

This archive adds no support-table observations and does not close #1454, #1427
or #1220. Hosted acceptance and the other original requirements remain open.
