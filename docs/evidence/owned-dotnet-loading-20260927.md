# Owned C# package loading, 2026-09-27

The [execution record](owned-dotnet-loading-20260927.json) captures three passing
tests without skips. Its SHA-256 is
`9baa553b2283985d503b88546b4882d936632d055848c1d5b3b3b13369500f04`.

Each ordinary and reviewed Lean build passed 167 assertions. An external C#
assembly calls the generated public API after the test removes the Lean
compiler workspace and managed package sources. The tests move the resulting
application and repeat the calls. Both paths end with zero native identities.

The loader checks every native file against its compiled hash, rejects symbolic
links, rejects unverified preloads, shares matching authenticated libraries, and
rejects conflicting runtimes and component receipts. Actual 257-bit integer
calls use `libgmp-lean-bridge.so.10`; a native address lookup checks that the
adapter uses the packaged private library. The GMP producer runs its upstream
test suite before producing that library.

The fork probe holds the managed registry lock on another thread, forks, and
requires the public API to reject the child before acquiring that lock. The
probe prepares its reverse P/Invoke entry in the parent first. .NET 8 uses
[shared JIT mappings](https://raw.githubusercontent.com/dotnet/runtime/v8.0.30/src/coreclr/minipal/Unix/doublemapping.cpp),
so compiling a new callback in the child can corrupt the parent's executable
mapping. The accepted test keeps the default CLR memory protections enabled.
This check does not make arbitrary managed execution after fork supported;
applications must start a fresh process.

The record binds 124 sources and two execution reports to the unchanged
[foundation](owned-dotnet-foundation-20260927.json) and
[callback](owned-dotnet-callbacks-20260927.json) records. It does not claim an
installed NuGet release, copied/owned package coexistence, or type-surface
promotion. Those have separate integration gates.
