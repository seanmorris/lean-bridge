# Installed .NET copied aliases, 21 September 2026

Prepared NuGet packages preserve 27 copied aliases over all nineteen primitive
types, chains, records and nested containers. C# callers use ordinary CLR target
values. C# source-file aliases cannot be exported from an assembly, so the package
keeps original alias identities and targets in its installed binding manifest,
README and XML API documentation. Method parameters, results and record fields
document their original contract types. The generator adds no wrapper identity
or consumer `global using` directives.

## Installed checks

The unchanged native alias Lean fixture builds through ordinary-source analysis
and independently authored reviewed IR. Both compiled contracts must match the
independent names, targets and signatures. Each archive installs offline after
the test removes its producer project and build directory.

Each public consumer passes 3,876 checks covering all nineteen primitive aliases,
exact 5,121-bit integers, fixed and machine-word limits, IEEE special values,
Unicode and NUL, alias chains, return-only aliases, records, nested List/Array
values, three nested Option Unit states, both Result branches, independent copies,
copy-budget failures and recovery. Lean independently checks nineteen record
fields; eighteen changed non-Unit fields each make that check fail. Four threads
also call the APIs independently.

Aliased Nat and Int both use `BigInteger`. Negative Nat inputs reject, including
inside a copied record, while negative Int values round-trip. Null reference
payloads, invalid UTF-16 and uninitialized Results reject. Unit results return
`void`. Twelve independently specified invalid C# programs fail at their own
source locations with exact diagnostic codes. These include a reference to a
nonexistent CLR alias wrapper. The positive consumer treats warnings as errors.

The installed binding manifest retains all 27 aliases and their original targets.
The compiled XML documentation lists every alias, preserves its use at API sites
and escapes nested type expressions. The archive receipt verifies the assembly,
documentation, manifest and native files.

An isolated copy of the verified generated sources injects 180 conversion
failures. Every probe releases scratch and clears any returned native output,
then successfully calls Lean again. Another 64 probes reject partial invalid
inputs without reaching Lean. Seventeen malformed native-value checks cover
flags, inactive branches, sequence buffers and lengths, UTF-8 and characters.
Instrumentation does not modify the installed release assembly.

The compiled consumer relocates outside its project. The test deletes that
project, installed package sources, handoff and isolated probes, then executes
the same 3,876 checks twice using a private .NET runtime with no SDK and no
compilers on PATH. The relocated assembly and native libraries retain their
recorded hashes. Both source paths contain identical compiled native libraries.

## Reproduce

```sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_DOTNET_ALIAS_TEST=1 node --test tests/dotnet-aliases.test.mjs
node --test tests/dotnet-alias-contract.test.mjs
```

The local host uses glibc 2.36 through the existing test override. Production
builds and CI retain the glibc 2.38 floor. The report is
`build/aliases/dotnet.json`; the [source-bound receipt](dotnet-aliases-20260921.json)
records both archives, compiler diagnostics, fault probes and relocated files.
CI requires and uploads the installed report. Comparing the preceding generator
against the new one produces byte-identical files for the independent alias-free
callback and List contracts.

The settled-source repeat reproduces both NuGet archives and release assemblies
byte-for-byte. Existing installed callback, compound and List suites pass
128,247, 41,534 and 99,180 public checks per source path, respectively. Their
compiler rejection, cleanup and runtime-only deployment checks also pass.

The new generator module ships in both CLI source allowlists and the Nix Perl
engine's transitive import closure. A packaged-module import test first reproduced
its omission, then passed after the allowlists were corrected. All 1,554 contract
tests pass with 66 gated skips. The 76 focused alias/type-surface/documentation
checks, 111 site tests, repository and site type checks, lint, generated-reference
checks and production site build also pass.

Inventory 0.49.0 promotes only six .NET alias cells: parameter, result and field
on both source paths. Historical archive inventories remain unchanged. Native
variants, recursive values, compound callable payloads and explicitly owned
identity-bearing aggregates remain open under VO1219 and VO1221.
