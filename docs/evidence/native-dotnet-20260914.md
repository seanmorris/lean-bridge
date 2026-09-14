# Ordinary-source C# and NuGet copied values

VO1216 adds generated C# APIs and prepared NuGet archives for ordinary Lean projects. This milestone is based on `3dd498065dbc058d55120eb0495d689f44d68ffb`; the type inventory binds its acceptance to the implementation and test source hashes.

## Acceptance

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_DOTNET_TEST=1 \
LEAN_BRIDGE_DOTNET=/app/.toolchains/dotnet/dotnet \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
node --test --test-reporter=spec tests/native-dotnet.test.mjs
```

The local run uses .NET SDK 8.0.424, runtime 8.0.30, GCC 12, and glibc 2.36 on Linux x86-64. Production packages retain the glibc 2.38 floor. Lean 4.32.2 is pinned to commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`.

Aurora and Boreal each expose 43 functions from unrelated source packages. Each builds twice from relocated, read-only sources. The NuGet archives match byte-for-byte. Consumers restore the original archives from a local feed after both source locations become unavailable. Their PATH contains no Lean, Node or C compiler. The generated packages include the native adapter, component and shared runtime; consumers call named C# methods without FFI declarations or runtime-path configuration.

The installed programs exercise all 16 primitive argument, result, array-element and record-field types. They cover signed minima, unsigned maxima, 4096-bit Nat/Int, Unicode and embedded NUL, NaN classification, infinities, signed zero, empty/scalar records, arrays of records, nested arrays and independent deep copies. Boreal reverses its leaf record's fields and uses UInt64 for a scalar-represented record where Aurora uses UInt32.

After 2,000 warmup calls, 10,000 UInt32 calls leave `GC.GetAllocatedBytesForCurrentThread()` unchanged. This measures managed allocations, not native allocations or a latency ratio.

Negative checks reject null nested values, malformed UTF-16, negative Nat and oversized copies. Repeated output-budget failures and concurrent calls execute the real native component. A two-package consumer calls Aurora and Boreal concurrently, then checks the native broker: one runtime initialization, two component initializations and two attached components. Loader checks reject altered native libraries; the packager rejects an altered managed assembly. A missing SDK leaves no partial release or staging directory.

Each build selects an installed .NET 8 SDK, pins its exact version in private `global.json`, and records it in the managed artifact manifest. The relocation test supplies hostile ancestor MSBuild properties, targets, package settings, response files and SDK selection. Those files do not affect the generated assembly or archive.

The four top-level .NET checks pass. The exact locally installed archives are:

| Archive | SHA-256 |
| --- | --- |
| `Acme.Aurora.2.0.0-rc.1.nupkg` | `5fef4cd4bff99e4703ac350cb190d8b9b3df15684600dd5ba8417b877d48b880` |
| `Acme.Boreal.2.0.0-rc.1.nupkg` | `ff1df11bfdb2fae0e2e261d8f9bd180b3af48a290d1b3863c51898e360473ca6` |
| `aurora-c-1.0.0-c.tar.gz` | `6a35976d541ebae3df22b1ac84d26676e9fdbae7eadffeb843643445200ca622` |

## Shared compilation and regressions

Aurora builds C and NuGet from the same native compilation. The mixed-profile Shop test builds npm, CPAN, C, C++ and NuGet from one captured source API, with one Wasm and one native compilation. Shop and Telemetry packages reproduce after relocation and run through installed consumers without their source trees. The seven mixed-profile checks pass using real compilers through an injected Nix-command transport; this local run does not execute Nix itself.

The seven ordinary C/C++ primitive and copied-value regression checks pass with unchanged archive hashes. Existing Alpha resource/callback generators remain separate and retain their contract tests. The .NET milestone advances exactly 54 ordinary-source inventory cells: argument, result and field positions for 16 primitives, arrays and records. JVM, Ruby, callback and reviewed-IR cells do not advance.

## Limits

The ordinary NuGet profile admits pure copied values with acyclic type nesting at most 32. Input and output share a 16 MiB native conversion budget. The managed adapter bounds input scratch independently and always releases scratch and deep native results. Lean's internal working memory is outside the conversion budget.

Nat and Int use `BigInteger`; arrays use `T[]`, ByteArray uses `byte[]`, and records use generated sealed C# records. Null has no implicit Lean meaning. Scalar-only calls create no input scratch scope. Native library handles live for the process lifetime; this acceptance does not establish collectible assembly unloading or mixed-language in-process composition.

Optional values, variants, resources, callbacks, effects, other platforms and further type families remain open. Generic package-set verification and signed publication integration remain under VO1240. This acceptance prepares local archives and performs no registry upload or Pages deployment.
