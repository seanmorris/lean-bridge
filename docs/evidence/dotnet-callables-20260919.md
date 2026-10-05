# .NET primitive callbacks and returned Lean functions

Ordinary-source and independently reviewed NuGet packages each pass 128,247
installed assertions. Both packages repeat those checks twice with a relocated
.NET runtime containing no SDK, compiler, NuGet cache, author sources or consumer
sources. The [acceptance record](dotnet-callables-20260919.json) retains the
archive, source, compiler, assembly, deployment and receipt identities.

## Public API

The 62-export fixture covers all nineteen primitives in synchronous callbacks
and returned closures, multiple callbacks in one call, mixed signatures, and
the maximum sixteen arguments. C# uses `Func` and `Action` delegates and
`LeanClosure<TDelegate>` with `Invoke`, `IsClosed` and `Dispose`. The compiled
assembly and matching native runtime ship in the NuGet archive. Consumers need
no Lean compiler or handwritten marshalling.

`Nat` and `Int` retain `System.Numerics.BigInteger`; `Char` uses `System.Text.Rune`.
The primitive callable adapter uses the existing private C ABI. No GMP library
or new NuGet dependency is introduced.

## Checks

- Exact signed and unsigned bounds, 31/32/53/64-bit boundaries and 16,385-bit
  integers survive host calls, captured state and both closure branches.
- Float32 and Float preserve signed zero, subnormals and infinities. NaN is
  checked by classification, not by payload. Unicode scalars, combining text,
  embedded NUL, empty strings and all byte values survive conversion.
- Callback exceptions preserve the original object, data and stack after
  native cleanup. The first failure prevents later callbacks in the same call.
  Valid calls still work after failure and the 64-invocation reentry limit.
- Null delegates and copied values, negative Nat, invalid UTF-16 and oversized
  conversions reject. Async Unit delegates, including multicast entries,
  reject before executing. Seven independently compiled invalid callers reject
  with the expected Roslyn diagnostics for types, widths, async results,
  closure signatures, arguments and private construction.
- Forced GC during callbacks leaves live delegates rooted. Copied byte
  arguments and results remain independent. An expired borrowed host callback
  cannot be invoked through a returned Lean function.
- Closures reject invocation on another thread, including after the creator
  thread exits. Cross-thread disposal is safe. Explicit disposal is idempotent;
  all aliases reject afterward. Keeping `Invoke` retains the same lease.
- Finalization reclaims abandoned closures. Registry exhaustion rejects
  without losing existing leases; cleanup permits 8,192 successive new leases.

A separately compiled production-state test checks active-call deferred release,
exception identity and rejection before locks when process identity changes.
That check substitutes a controlled PID; it does not fork the CLR. Production
checks use libc `getpid`, and finalizers skip native cleanup in a forked child.

The Aurora/Boreal suite rebuilds unrelated NuGet packages in different source
locations and requires identical archive bytes. It exercises copied scalars,
nested arrays/records, zero-allocation scalar calls, concurrent use, tamper
rejection, cross-package callbacks/closures and nested exception identity in a
single shared Lean runtime. A failing compiler leaves no partial package.

The independent Shop/Telemetry corpora match fresh Lean oracle results on both
source paths. Each path has 92 executed catalog cases, 32 compiler rejections
and 60 supplemental runtime rejections. The existing source-free and
reproducibility checks still pass.

```sh
LEAN_BRIDGE_DOTNET_CALLABLE_TEST=1 node --test tests/dotnet-callables.test.mjs
node --test tests/dotnet-callable-contract.test.mjs
LEAN_BRIDGE_NATIVE_DOTNET_TEST=1 node --test tests/native-dotnet.test.mjs
npm run test:type-corpus:dotnet
LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES=dotnet node --test tests/type-corpus-reviewed-native.test.mjs
```

Local checks use .NET SDK 8.0.424, GCC 12.2.0 and glibc 2.36. The declared package
and CI floor stays glibc 2.38. The 16 MiB conversion budget does not bound Lean
or CLR working memory. This milestone does not cover compound callable
arguments, identity-bearing resources, asynchronous delivery or other hosts.
