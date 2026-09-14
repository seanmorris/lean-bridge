# Ordinary-source WIT/Wasmtime copied values

VO1216 adds executable WIT packages for ordinary Lean projects. This milestone is based on `55fb1765d5bdf8db590fdffe9e65394e44e7d8f3`; the type inventory binds the implementation and acceptance to source hashes.

## Acceptance

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_WIT_TEST=1 \
LEAN_BRIDGE_WASMTIME_C_API=/app/.toolchains/wasmtime42 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
node --test --test-reporter=spec tests/native-wit.test.mjs
```

All four top-level checks pass. The local profile uses GCC 12, glibc 2.36, wasm-tools 1.245.1 and the official Wasmtime 42.0.1 C API on Linux x86-64. The production floor remains glibc 2.38. Lean 4.32.2 is pinned to commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`.

Cobalt and Saffron each expose 40 functions. Each project builds from two relocated source trees, producing identical WIT and C archives. Both source directories are hidden before the archives are extracted and consumers compile against installed public headers and libraries. Consumer execution needs neither Lean nor an external Wasmtime installation.

Calls cross the actual Component Model binary. The session helper embeds those bytes; an independent C embedding also loads the packaged `.wasm` file, supplies generated native imports and invokes an export directly through Wasmtime. The consumer documentation's C program compiles and prints `42`.

The installed suite covers all sixteen primitive arguments, results, array elements and record fields. It also exercises nested arrays and records, empty records, arrays of empty records, scalar-represented records, multiple arguments and nullary functions. Saffron reverses its leaf field order and uses UInt64 where Cobalt's single-field record uses UInt32.

Values include unsigned maxima, signed minima, integers above 4096 bits, zero, Unicode with embedded NUL, byte values, binary32 rounding, NaN classification, infinities and signed zero. Returned values own independent storage and remain valid after closing a session. Wrong value kinds, malformed UTF-8, noncanonical integers, missing record fields, unknown functions and excessive lengths fail before caller buffers are copied.

A generated native array fits the native budget but exceeds WIT output conversion limits. Repeated failed calls release the native result, discard the trapped store and permit a subsequent valid call. Test-only allocation hooks fail the third input scratch allocation, check that earlier allocations are freed, and count the native output clear operation. The suite also rejects modified compiled host artifacts and checks that a missing pinned engine leaves no partial release. Two installed packages observe one Lean runtime initialization, two component initializations and two attached components.

The combined project suite passes all seven checks. Shop builds npm, CPAN, C, C++, NuGet, Maven, RubyGems and WIT packages from one captured API, sharing one native and one WebAssembly compilation. Installed consumers execute every target. This local check replaces only the Nix transport; it uses the real language compilers and does not establish Nix execution acceptance.

| Artifact | SHA-256 |
| --- | --- |
| `cobalt-api-2.0.0-rc.1-wit-wasi.tar.gz` | `597371d42980a91071998e39a34959bd730b28531bfa3f8b47445671d9bd7975` |
| `saffron-api-2.0.0-rc.1-wit-wasi.tar.gz` | `fd4f2a9a26e3bfd8ba240867309464dccabc79b42ff019e7aaa8c72174b6d929` |

## Contract and limits

The native interface owns the copied WIT types. Public functions use those types through generated canonical lowering and lifting. The adapter follows the synchronous [Canonical ABI flattening rules](https://github.com/WebAssembly/component-model/blob/main/design/mvp/CanonicalABI.md#flattening): at most sixteen flat parameters and one flat result, with indirect storage otherwise.

Unit and empty records use single-case enums. Nat uses least-significant-first `list<u32>` limbs; Int adds a sign flag. Empty limbs represent zero. Trailing zero limbs and negative zero are rejected. WIT built-in scalars retain their widths; arrays and records copy recursively.

Native input/output conversions and WIT conversion scratch have separate 16 MiB budgets. Canonical linear memory is capped at 64 MiB and reset after each successful call. The session helper replaces trapped stores; custom embeddings must discard trapped instances. Types are acyclic and at most 32 levels deep. These bounds do not limit Lean or Wasmtime engine working memory. Wasmtime's C allocation API has no recoverable out-of-memory result; fault injection covers the adapter's scratch allocator and native output cleanup, not every allocator in the process.

Each session belongs to one calling thread. Use the packaged Wasmtime 42.0.1 ABI throughout the process; mixing other engine versions is outside this profile. Shared native libraries remain loaded according to the existing native runtime contract.

The ordinary adapter does not admit resources, callbacks, optional values, variants or effects. Alpha retains its separate resource-oriented WIT projection and `read-box` host probe. The type inventory advances exactly 54 ordinary-source WIT cells: arguments, results and fields for sixteen primitives, arrays and copied records. It does not promote other profiles or reviewed-IR observations.

The archive assembler revalidates compiler receipts, generated sources, the compiled host, and the pinned Wasmtime headers/library/license before copying them. Packaging has no compiler access. Generic package-set verification and signed publication integration remain under VO1240. No registry upload or deployment occurs in this acceptance.
