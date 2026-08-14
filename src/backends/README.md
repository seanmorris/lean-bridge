# Language backends

Backends render canonical Binding IR and ABI plans as ordinary host-language APIs. They select host syntax, standard library types, package source layout, and private transport code. They do not change declaration identity, copied versus identity semantics, ownership, failures, or assurance metadata.

## Generation pipeline

```text
Binding IR + ABI plans + target profile
                  |
                  v
        language projection model
                  |
                  v
 public source and type metadata
                  |
                  v
 package audit and semantic parity gate
```

Generators return in-memory file maps or projection records. Release modules place reviewed files into registry archives.

## Backend map

| Directory | Generated surface | Local modules |
|---|---|---|
| [`javascript`](javascript/) | Direct ESM functions, classes, callbacks, Promises, iterators, browser exports, and TypeScript declarations. | Projection compiler, package generator, coverage report, and public-surface audit. |
| [`php`](php/) | One typed PHP API shared by native Zend and PHP-Wasm transports. | Projection, conformance corpus, package audit, Zend source, native runtime, and PHP-Wasm adapter generation. |
| [`python`](python/) | Python functions, value types, resources, callbacks, closures, and package metadata. | Generator and package audit. |
| [`rust`](rust/) | Rust functions, owned resources, copied values, callback traits, and declared `Result` paths. | Generator and package audit. |
| [`c`](c/) | C11 header and implementation over the generated native component boundary. | Generator and package audit. |
| [`cpp`](cpp/) | C++20 wrappers with move-only resource ownership and RAII cleanup. | Generator over the C package. |
| [`dotnet`](dotnet/) | C# API and `LibraryImport` transport for .NET 8. | Binding package generator. |
| [`jvm`](jvm/) | Java API over the JDK 22 Foreign Function and Memory API, with Kotlin-compatible metadata. | Binding package generator. |
| [`ruby`](ruby/) | Ruby API and RBS signatures over `Fiddle`. | Binding package generator. |
| [`managed`](managed/) | Shared Alpha model, manifest, and package audit used by .NET, JVM, and Ruby. | Common model compiler and audit. |
| [`wit`](wit/) | Portable WIT subset, Component Model adapter inputs, and consumer probe. | Package generator and composition verification. |
| [`lean`](lean/) | Lean-side adapters for declared host objects. | Host object generator. |

## Public and private boundaries

Public packages expose named declarations and idiomatic resource types. Generic dispatch, raw component symbols, pointers, numeric handles, Wasm engine objects, runtime identity values, and transport configuration remain private. Package audits scan generated sources, declarations, stubs, and metadata for those leaks.

A backend may report a closed capability gap when its selected profile cannot preserve an IR requirement. It may not silently narrow a value, drop an error, change ownership, or simulate execution.

## Shared semantics

[`../binding-ir/semantic-parity.mjs`](../binding-ir/semantic-parity.mjs) compiles one semantic corpus for all selected backends. The parity gate compares callables, values, resources, errors, callbacks, cleanup, documentation, assurance, and capability gaps. ABI plans under [`../abi`](../abi/README.md) supply the transport-neutral details.

## Adding a backend

1. Add a target identifier and runtime profile.
2. Map every required IR shape or emit an explicit capability gap.
3. Generate direct public APIs and keep transport controls private.
4. Add deterministic source generation and package audit tests.
5. Add the backend to semantic parity and forbidden-surface gates.
6. Add a compile-free release projection.
7. Install the package in a clean consumer and execute real Lean before promoting support.

Generator tests are named by language under [`../../tests`](../../tests/README.md). Cross-language evidence is recorded in [semantic parity](../../docs/evidence/cross-language-semantic-parity.md), while current support remains in the [versioned support contract](../../docs/consumer-support.v1.json).
