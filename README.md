# Lean Bridge

Lean Bridge packages ordinary Lean declarations for direct use from host languages. The proof of concept compiles one runtime-free Lean component, generates typed bindings, and places the component beside a shared Lean runtime. Consumers install package archives and call named functions or classes without writing a Wasm loader or foreign-function wrapper.

The current implementation gives package authors:

- one analysis result derived from Lean source and Lake metadata;
- one compiled component reused by package projections;
- deterministic artifacts, manifests, provenance, and receipts; and
- clean-consumer tests that separate executable targets from generated-only targets.

## Consumer support

`supported` means that a clean consumer installs the documented artifact and executes a real Lean component. `partial` means that package or interface behavior passes while an ordinary package workflow remains incomplete. `blocked` means that CI verifies the named missing capability.

| Consumer | State | Current boundary |
|---|---|---|
| JavaScript on Node | `supported` | Node 22 ESM installs the runtime and component npm archives. |
| TypeScript on Node | `supported` | Strict TypeScript compiles the generated declarations and runs on Node 22. |
| Browser JavaScript | `supported` | The installed npm archive resolves its browser export and executes Lean in Chromium. |
| Native PHP | `supported` | PHP 8.2 NTS on x86-64 Linux uses the generated Zend extension. |
| PHP-Wasm | `supported` | PHP 8.4 uses the same generated PHP API in the Node-hosted PHP-Wasm runtime. |
| .NET | `supported` | .NET 8 restores the NuGet package and uses generated `LibraryImport` bindings. |
| JVM | `supported` | JDK 22 resolves the Maven package and uses the finalized Foreign Function and Memory API. |
| Ruby | `supported` | MRI Ruby 3.3 installs the RubyGem and calls Lean through `Fiddle` without building an extension. |
| Python | `supported` | The x86-64 Linux wheel for glibc 2.38 or newer loads the packaged native component through its generated adapter. |
| Rust | `supported` | The crate uses the packaged native component through its generated runtime adapter. |
| C | `supported` | The C11 package links the generated API to the shared native Lean component. |
| C++ | `supported` | The C++20 package adds typed RAII wrappers over the same native component. |
| WIT/WASI | `supported` | A Wasmtime Component Model adapter calls real Lean through the generated native API. |

The versioned [consumer support contract](docs/consumer-support.v1.json) is the source for CI and documentation checks. [Consumer status and API previews](docs/consumers.md) explain the evidence for every row.

The pinned native package profile targets x86-64 Linux with glibc 2.38 or newer.

## Package a Lean library

Lean Bridge reads documented public definitions. This project requires no bridge annotation:

```lean
namespace OnboardingSmall

/-- Add two natural numbers. -/
def add (left right : Nat) : Nat := left + right

/-- Return whether a copied UTF-8 string is empty. -/
def isEmpty (value : String) : Bool := value.isEmpty

end OnboardingSmall
```

Install the POC CLI from a local checkout, then analyze and build a Lake project:

```sh
npm install --global <checkout>
lean-bridge analyze --project . --check --output build/analysis
lean-bridge build --project . --target npm --output build/lean-bridge-release
lean-bridge publish --project . --target npm --dry-run --output build/lean-bridge-dry-run
```

The dry run builds twice, compares the complete package inventory, writes npm archives and a receipt, and performs no registry write. The [Lean package author guide](docs/lean-author-guide.md) covers prerequisites, export rules, adapter questions, outputs, receipt verification, exit codes, and failures.

## Call Lean from JavaScript

The generated package exports direct native callables. Lean `Nat` maps to JavaScript `bigint`.

```js
import { add, isEmpty } from "onboarding-small";

console.assert(add(100n, 23n) === 123n);
console.assert(isEmpty("") === true);
```

The [JavaScript and TypeScript guide](docs/javascript-typescript.md) installs both archives with lifecycle scripts disabled, runs these calls in a clean project, compiles the TypeScript surface in strict mode, and verifies the component receipt. The [PHP guide](docs/php.md) covers native Zend and PHP-Wasm through one generated PHP API.

## Type conversions

Generated bindings preserve ranges, precision, field structure, and ownership instead of routing values through JSON. The high-level package projections use these host representations:

| Lean type | JavaScript and TypeScript | PHP | Python | Boundary behavior |
|---|---|---|---|---|
| `Bool` | `boolean` | `bool` | `bool` | Direct scalar conversion. |
| `UInt8`, `UInt16`, `UInt32` | validated `number` | validated `int` | validated `int` | Values outside the declared range are rejected. |
| `Int8`, `Int16`, `Int32` | validated `number` | validated `int` | validated `int` | Signed ranges are preserved. |
| `Int64` | `bigint` | `int` on the supported 64-bit build | `int` | The full signed 64-bit range is preserved. |
| `UInt64`, `Nat`, `Int` | `bigint` | generated `BigInteger` | `int` | Full-width or arbitrary precision is preserved. |
| `Float32`, `Float` | `number` | `float` | `float` | Conversion follows the declared IEEE width. |
| `String` | `string` | `string` | `str` | UTF-8 text is copied directly. |
| `ByteArray` | `Uint8Array` | generated `Bytes` | `bytes` | Binary data remains distinct from text. |
| `Array T` | `ReadonlyArray<T>` | typed `list<T>` | `tuple[T, ...]` | Elements use the generated mapping for `T`. |
| `Except E T` | generated result union | generated `Result` value | generated result union | Error values remain structured. |
| structure | generated interface or value class | readonly value object | frozen value class | Field names and mapped field types are preserved. |
| identity-bearing value | generated class | generated resource class | generated class and context manager | One live wrapper refers to one retained Lean identity. |

The current .NET, JVM, and Ruby profile covers the Alpha conformance subset directly:

| Lean shape | .NET 8 | JDK 22 | MRI Ruby 3.3 |
|---|---|---|---|
| `Bool` | `bool` | `boolean` | `true` or `false` |
| `UInt32` | `uint` | range-checked `long` | range-checked `Integer` |
| `String` | `string` | `String` | frozen `String` copy |
| `ByteArray` | `ReadOnlyMemory<byte>` | copied `byte[]` | frozen binary `String` |
| `Array UInt32` | `ReadOnlyMemory<uint>` | copied, range-checked `long[]` | frozen `Array<Integer>` |
| identity-bearing value | sealed `IDisposable` class | final `AutoCloseable` class | class with deterministic `close` |
| callback or returned callable | delegate or owned callable | functional interface or owned callable | block or callable object |

`Option T` maps to a nullable host value in the current high-level projections. Nested nullable shapes require an explicit adapter decision. Richer mappings and target-specific C, C++, Rust, and WIT types are generated from the same [native binding contract](docs/architecture/native-bindings.md#primitive-and-copied-value-mapping). An unsupported target mapping stops package generation.

## Runtime performance

Generated native calls are single-digit nanoseconds in C and C++, 9.3 ns in Rust, 20.3 ns in .NET, hundreds of nanoseconds in PHP, JavaScript, and the JVM, under 2 µs in Python and PHP-Wasm, and 4.26 µs in Ruby on the reference machine. Sharing one runtime across 50 Lean libraries cuts Wasm linear-memory allocation from 851,968,000 bytes to 17,039,360 bytes, a 50-fold reduction.

The downstream measurements below ran on 12 and 13 August 2026 using Linux x86-64 and an Intel Core i7-7700K. Node consumers used Node 22.23.1. Each steady-state row reads the same retained Lean `Box` through the installed generated API after 10,000 warm-up calls, then measures 100,000 calls.

| Installed consumer | Generated API result |
|---|---:|
| C11, Release | 5.5 ns/call |
| C++20, Release | 5.9 ns/call |
| Rust, release profile | 9.3 ns/call |
| .NET 8 | 20.3 ns/call |
| Native PHP | 259.6 ns/call |
| Browser JavaScript in Chromium | 353.0 ns/call |
| TypeScript on Node | 399.0 ns/call |
| JavaScript on Node | 408.1 ns/call |
| JDK 22 | 537.1 ns/call |
| Python | 1.66 µs/call |
| PHP-Wasm | 1.94 µs/call |
| MRI Ruby 3.3 | 4.26 µs/call |
| WIT/WASI | 8.66 ms/invocation, including host process and component startup |

These are observational end-user API measurements, not cross-machine comparisons. The [original downstream performance record](docs/evidence/downstream-consumer-performance-20260812.md) and [managed consumer record](docs/evidence/managed-consumer-acceptance.md#end-user-performance) contain exact durations, scope, and limitations. The [library scaling record](docs/evidence/library-scaling.md) contains the shared-runtime memory measurements.

## Documentation

- [Documentation map](docs/README.md)
- [Lean package author guide](docs/lean-author-guide.md)
- [JavaScript and TypeScript consumer guide](docs/javascript-typescript.md)
- [PHP consumer guide](docs/php.md)
- [.NET, JVM, and Ruby consumer guide](docs/dotnet-jvm-ruby.md)
- [Python, Rust, C, C++, browser, and WIT/WASI status](docs/consumers.md)
- [Implementation status and inventory](docs/status.md)
- [Architecture index](docs/architecture/README.md)
- [Evidence index](docs/evidence/README.md)
- [Contributing](CONTRIBUTING.md)

This repository is an architecture-testing proof of concept. It publishes no live registry package and includes no live registry adapter.
