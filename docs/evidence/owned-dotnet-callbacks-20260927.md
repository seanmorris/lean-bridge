# Owned C# callbacks, 2026-09-27

The [execution record](owned-dotnet-callbacks-20260927.json) binds the generated
C# callbacks to fresh ordinary and reviewed Lean compilation. Its SHA-256 is
`d433d2b37afbec89f3b36a399444021d323872a4ecb1f44bd6a8777fbbbef44f`.

The callback run passed five tests without skips. Each compilation path checked
504 ownership and failure cases, including 96 managed and 95 native allocation
failures. The repeated-callback budget stopped the call after 1,023 invocations.
Each path also checked retirement, with zero remaining native allocations and
identities after cleanup.

The expanded fixture executed callbacks for all 19 scalar types and an incoming
native closure: 20 calls and 38 assertions per compilation path. It covers
exact float echo bits, large integers, Unicode, byte arrays, callback borrow
expiry and retention, typed recovery, asynchronous delegate rejection, and
multicast delegates. Returned higher-order closures and original exception
identity are checked in the composition fixture.

The record contains 118 source hashes, four callback reports, two additional
compiler input sets, and 11 foundation regression reports. The foundation
regression passed all 14 tests without skips. The original
[foundation record](owned-dotnet-foundation-20260927.json) remains unchanged;
the callback record preserves the exact predecessors of the two modified
runtime sources from commit `5d3863c0cdababbc85b6d4028dc655316044929f`.

These runs test generated call bindings, not installed NuGet packages. Package
loading, NuGet assembly and installation have separate acceptance gates. This
record makes no type-surface promotions and does not claim transferred input
ownership, anchored results, or completion of VO task 1219.
