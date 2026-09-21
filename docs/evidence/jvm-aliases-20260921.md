# Installed Java and Kotlin copied aliases, 21 September 2026

Prepared Maven packages retain 27 copied aliases over all nineteen primitive
types, alias chains, records and nested containers. Java and Kotlin consume
the same generated Java API. Calls use ordinary target values. The installed
binding manifest, README and Java source documentation preserve alias names,
original targets and their use at parameters, results and record components.
This profile does not export separate Kotlin typealias declarations or Java
wrapper classes.

## Installed checks

The shared native alias Lean fixture builds through ordinary-source analysis
and independently specified reviewed IR. Both compiled contracts must match
the independent alias targets and signatures. Each archive installs offline
after the test removes its producer project and build directory.

Java and Kotlin each pass 3,711 public checks on each source path. These cover
all nineteen primitive aliases, exact 5,121-bit integers, fixed and machine-word
limits, IEEE special values, Unicode and NUL, alias chains, return-only aliases,
record fields, nested List/Array values, three nested Option Unit states and
both Result branches. Lean independently checks nineteen record fields;
eighteen changed non-Unit fields each make that check fail. Four concurrent
callers retain independent values.

Aliased Nat and Int both use `BigInteger`, but negative Nat inputs reject,
including inside records. UInt32 retains its unsigned 32-bit range despite
using Java `long` and Kotlin `Long`. Returned arrays own independent storage.
Nulls, invalid characters, malformed UTF-16, invalid nested payloads and
oversized copies reject. Calls after budget failures verify recovery. Unit
inputs use the generated enum; Unit outputs return `void` or Kotlin `Unit`.

Each consumer rejects twelve invalid programs at their source locations with
exact compiler diagnostic codes. Generated Java sources, Javadoc and both
positive consumers compile with warnings denied.

Separate instrumented copies of verified sources inject 237 conversion and
allocation failures per source path. Every probe closes its arenas and clears
returned native allocations. Eighteen malformed-native checks cover flags,
inactive branches, sequence lengths and buffers, UTF-8 and characters. Another
64 partial-input failures reject before reaching Lean. Instrumentation leaves
the release JAR unchanged.

Each compiled consumer relocates outside its Maven project. The test removes
that project and its installed package sources, then executes the consumer
twice with a private `java.base` runtime and no compilers on PATH. Kotlin adds
only its standard-library JAR. Deployment hashes remain unchanged, both source
paths contain identical native libraries, and normal process exit removes
extracted native assets. Package receipts verify metadata, sources, classes
and native files.

## Reproduce

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_JVM_ALIAS_TEST=1 node --test tests/jvm-aliases.test.mjs
node --test tests/jvm-alias-contract.test.mjs
```

The local host uses glibc 2.36 through the existing test override. Production
builds and CI retain the glibc 2.38 floor. The report is `build/aliases/jvm.json`;
the [source-bound receipt](jvm-aliases-20260921.json) records all four executions,
compiler diagnostics, fault probes and prepared artifacts. CI requires and
uploads the installed report.

The settled-source repeat reproduces both JARs and POMs byte-for-byte. Comparing
the preceding generator with this one produces identical files for the
alias-free callback, compound and List contracts. All 1,560 contract tests pass,
with 67 gated skips. The 76 focused documentation/type-surface/alias checks,
111 site tests, five CLI package tests, repository/site type checks, lint,
generated-reference verification and production site build also pass.

Inventory 0.50.0 promotes only twelve Java/Kotlin alias cells: parameter, result
and field on both source paths. Historical archive inventories remain unchanged.
The remaining five alias profiles, native variants, bounded recursive values,
compound callable payloads and explicitly owned identity-bearing aggregates
remain open under VO1219 and VO1221.
