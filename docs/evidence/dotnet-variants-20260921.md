# Installed .NET tagged variants

VO1219 adds named C# constructor records to prepared NuGet packages on
ordinary-source and independently reviewed IR paths. Consumers construct and
pattern-match cases with typed payloads. The package copies inputs into Lean
and returns independent managed values.

The [machine record](dotnet-variants-20260921.json) binds independent contracts,
test sources, original archives, installed assemblies and failure probes.

## Representation and ownership

`SignalData(uint Count, string Label)` and `SignalMarker(Unit Value)` are
different sealed records derived from the abstract `Signal` record. Empty
constructors have no payload. Constructor and property names use PascalCase;
trailing underscores distinguish source names. Generated type names, constructor
names and inherited record members cannot collide.

The public API exposes no numeric tag, pointer, union or unsafe operation.
Private unmanaged structs and explicit-layout unions match the generated C
transport. Conversion checks the tag before reading the active union member.
Generated Lean helpers construct and inspect the actual Lean value without
reading compiler object offsets or runtime tags.

Payloads can contain all nineteen primitives, copied records, arrays, Lists,
options, results, products and other admitted variants. Null cases, active null
fields and unrecognized derived records reject before Lean runs. C# permits an
external record to derive through the base record's protected copy constructor;
the input adapter rejects that unknown case. The installed consumer tests it.

Payload properties are init-only. Arrays inside them remain mutable, and ordinary
C# record equality compares those arrays by reference. Calls copy their contents;
deep comparison requires comparing the elements. The 32-level type bound and
separate managed/native 16 MiB conversion budgets remain in force. These budgets
do not bound every managed allocation or Lean's working memory.

## Installed checks

The shared Lean fixture has fourteen exports, seven variants and eighteen
constructors. Each public execution passes 209,519 assertions, including
constructor transitions, 5,121-bit integers, fixed/platform widths, IEEE special
values and signed zero, Unicode/NUL, binary buffers, nested records/containers
and independent result storage. Lean independently inspects scalar payloads;
eighteen changed-field cases fail that inspection. Parallel workers make 256
independent calls. Nineteen invalid input and budget cases recover with valid
subsequent calls.

The author is removed before installation. Consumers restore the original
`Lean.Variants.1.0.0.nupkg` offline from a local feed. It is the application's
only package dependency. Compilation uses the .NET 8 SDK with warnings treated
as errors and no Lean or C compiler on the consumer PATH. Eight independent
invalid programs fail for their intended type, payload, fixed-width, abstract
base, init-only property or private runtime diagnostics.

Each consumer runs once after installation. The test relocates the published
application, removes its source, package cache and archive handoff, then runs it
twice with only the .NET runtime installed. Both runs repeat all 209,519
assertions. The deployed assembly and four native libraries retain their
receipt hashes. An independent rebuild reproduces both original NuGet archives
and every installed package file byte for byte.

## Failure probes

A separate assembly compiled from verified generated sources injects 152
conversion/allocation failures across nine calls. Each releases tracked native
scratch storage and clears any entered native call's output exactly once.
Valid calls then succeed. Sixty-four partial-input failures also release
scratch and reject before entering Lean. These probes do not instrument or
replace the original installed release assembly.

Seven invalid native tags reject before poisoned union storage is read. Six
multi-case variants convert their first constructor while inactive storage
remains poisoned. The single-case variant has no inactive constructor to probe.
These private layout checks use reflection and unmanaged memory; the public
consumer uses only the generated API.

Each build also runs the shared real-Lean native probe: 1,182 assertions,
242 allocation failures, seventy invalid inputs and one injected returned tag.
ASan and UBSan report no errors. The full LSan report matches the startup-only
GMP baseline of 128 bytes in twelve allocations. No additional conversion leaks
are reported; the runtime exit baseline is not empty.

## Reproduce

Use the [NuGet author toolchain](../publish/nuget.md), .NET SDK 8.0.424 and a
native compiler with ASan/UBSan. The runtime-only reruns use .NET 8.0.30.

```sh
source scripts/env.sh
LEAN_BRIDGE_DOTNET_VARIANT_TEST=1 node --test tests/dotnet-variants.test.mjs
node --test tests/dotnet-variant-contract.test.mjs tests/dotnet-variant-evidence.test.mjs
```

CI requires and retains `build/variants/dotnet.json`. Fixtures remove their
temporary author and consumer directories. No package was published.

## Scope

This record advances six .NET copied variant parameter/result/field cells.
Seven consumer profiles still need copied-variant acceptance. Bounded recursive
copied values, compound callable payloads and explicitly owned identity
aggregates remain open.
