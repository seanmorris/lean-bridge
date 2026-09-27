# Resource-containing C# packages

Task: VO 1219. Baseline: `ab88c3888c3db7d4a1946e79093773233cdfafef`.

The NuGet projection compiles resource-containing records, variants, recursive
values and typed synchronous callbacks from ordinary Lean source or reviewed
Binding IR. Consumers use sealed resource wrappers, nominal values and typed
delegates from the installed assembly. Consumer code needs no unsafe blocks,
Lean compiler, native compiler or separate Lean runtime setup.

## Lifetime and execution

Each returned resource or closure wrapper owns a checked lease. `Dispose`
closes that wrapper; `Retain` creates an independent native owner. Copying a
record shares its resource wrappers. Callback arguments borrow their resources
until the callback returns. Keeping one requires an explicit retain.

Native thread-local destructors drain creator-thread owners even if the CLR
still holds the dead `Thread` and its wrappers. Cross-thread disposal and
finalization queue cleanup. They do not enter Lean on the finalizer thread.

Conversions preserve all nineteen scalar types inside bounded compositions.
The limits are 128 levels, 262,144 nodes, a 16 MiB native budget and a separately
accounted 16 MiB managed budget. Typed recovery handles callbacks whose result
has no default inhabitant. Host exceptions rethrow after native cleanup.

## Installation checks

`tests/owned-dotnet-packaging.test.mjs` builds four real NuGet packages: ordinary
and reviewed composition/callback APIs, and ordinary and reviewed scalar-record
APIs. It installs each original archive from an offline feed, compiles external
safe C# consumers, and rejects ill-typed consumer programs. It also checks
deterministic archive reassembly and rejects eight classes of changed artifacts.

After installation, the test deletes author sources, producer output, handoffs,
feeds and package caches. It moves the consumer deployment and executes it with
only the .NET host and runtime copied into a directory containing no SDK. The
composition cases also compile and run the exact consumer-guide example.

`tests/owned-dotnet-coexistence.test.mjs` installs two owned packages, a recursive
copied package and an ordinary package. Eighteen processes cover three initial
load orders, retirement through either adapter family, and three post-fork call
paths. Each process performs cross-package callbacks and 64 threaded call groups.
The observed result is four components, one runtime initialization, eleven
authenticated libraries and zero remaining native identities.

The controlled fork probes warm their reverse P/Invoke and exception paths in
the parent, retain normal CLR memory protections, and hold the loader registry
lock in another thread. Each child must reject its call before taking that
inherited lock or invoking a cached native entry. Packages require a fresh
process after fork; these probes do not establish general CLR fork support.

The loader authenticates regular native files and directories before loading,
rejects unverified preloads and conflicting identities, and shares one registry
with the copied-value adapters. Private GMP supplies exact integer conversion.

## Evidence

The immutable [foundation](owned-dotnet-foundation-20260927.json),
[callback](owned-dotnet-callbacks-20260927.json) and
[loading](owned-dotnet-loading-20260927.json) records retain their original
source identities and observations. The package execution and integration
records bind new installed reports to whole source hashes and literal reversible
changes. Earlier host records remain unchanged.

This milestone does not promote type-inventory cells or complete task 1219.
Transferred inputs, anchored results, remaining host projections and Wasm
ownership remain separate requirements.
