# Language backends

Backends project canonical Binding IR into host-language APIs. They choose idiomatic syntax and report capability gaps without changing declaration semantics.

## Backend map

| Directory | Output |
|---|---|
| [`javascript`](javascript/) | JavaScript runtime package and TypeScript declarations. |
| [`php`](php/) | Shared PHP projection plus native Zend and PHP-Wasm adapters. |
| [`python`](python/) | Python package sources and audit records. |
| [`rust`](rust/) | Rust crate sources and audit records. |
| [`c`](c/) and [`cpp`](cpp/) | C API and C++ RAII projection. |
| [`dotnet`](dotnet/), [`jvm`](jvm/), and [`ruby`](ruby/) | Managed-language APIs over the shared native runtime. |
| [`managed`](managed/) | Fixtures and audits shared by managed-language generators. |
| [`wit`](wit/) | Portable WIT subset projection. |
| [`lean`](lean/) | Lean-side host object generation. |

Backends consume [`../binding-ir`](../binding-ir/README.md). Registry archive construction belongs in [`../release`](../release/README.md).

See the [Binding IR architecture](../../docs/architecture/binding-ir.md), [native binding contract](../../docs/architecture/native-bindings.md), and [cross-language parity evidence](../../docs/evidence/cross-language-semantic-parity.md).
