# Generated Native Binding Contract

## Public API rule

The public API is made of direct, named, idiomatic host-language callables and types. Generic dispatch is private runtime machinery.

JavaScript and Python developers install a package, import a function or class, call it, and move on. They do not call `ccall`, `cwrap`, `invoke`, `dispatch`, raw `_symbols`, or an ABI frame function. They do not pass pointers, numeric handles, signature IDs, ownership flags, Wasm memories/tables, or manually written wrappers.

```ts
import { Statistics, Sample } from "@lean-wasm/statistics";

const sample = new Sample([1, 2, 3]);
const mean = await Statistics.mean(sample);
sample.dispose();
```

```python
from lean_wasm_statistics import Sample, Statistics

with Sample([1, 2, 3]) as sample:
    mean = await Statistics.mean(sample)
```

The exact APIs are generated from Lean declarations and binding metadata; these examples state the experience, not a handwritten wrapper contract.

Dynamic loading follows the same rule. Loading resolves and links the package,
then returns its generated native surface, never a linker handle or generic call
object:

```ts
const beta = await libraries.load("beta");
beta.chain(9);
```

The returned object contains ordinary named functions, classes and values. Any
underscore-prefixed ABI symbol and the dynamic-link handle remain private to the
loader.

Loading is demand-driven and idempotent. A request loads only the selected
package and the minimum transitive dependency graph required to link it;
concurrent requests share one in-flight operation and completed packages reuse
one projected API object. Unrelated packages, optional capabilities and the
threaded runtime are not preloaded. Lean runtime initialization and optional
resources are deferred until their first semantic use wherever doing so
preserves the declared API behavior.

## Complete generation boundary

The binding generator owns:

- host naming, parameters, defaults and overload-safe projections;
- input validation and structured diagnostics;
- scalar, copied-value and identity-value lowering/lifting;
- ABI symbols, frames and calling conventions;
- handle lookup, nominal-kind checks and canonical wrapper reuse;
- borrows, retained leases, callback capture and deterministic cleanup;
- Promise/awaitable settlement, cancellation and late-result handling;
- iterator/async-iterator adaptation;
- domain-error and exception translation;
- initialization, dependency loading and artifact selection; and
- TypeScript declarations, Python stubs, validators, docs and conformance tests.

No manually maintained public wrapper may duplicate this logic.

## Primitive and copied-value mapping

The binding IR records numeric width, signedness, precision, constructor tags, field names, mutability, copy policy, and ownership. A backend chooses an idiomatic host representation that preserves those facts. It may not send a typed value through JSON or narrow it silently.

| Lean type | JavaScript and TypeScript | Python | Required behavior |
|---|---|---|---|
| `Bool` | `boolean` | `bool` | Direct scalar conversion. |
| `UInt8`, `UInt16`, `UInt32` | validated `number` | validated `int` | Reject values outside the declared range. |
| `UInt64` | `bigint` | `int` | Preserve all 64 bits. |
| `Nat`, `Int` | `bigint` | `int` | Preserve arbitrary precision. |
| `Float`, `Float32` | `number` | `float` | Follow the declared IEEE width and conversion policy. |
| `String` | `string` | `str` | Copy UTF-8 directly. |
| `ByteArray` | `Uint8Array` | `bytes` or `memoryview` | Copy by default. Require an explicit lease for a zero-copy view. |
| `Option T` | generated tagged union | generated tagged union | Preserve nested `none` and `some` cases. |
| structure | generated interface or value class | dataclass or value class | Preserve field names and mapped field types. |
| inductive type | discriminated union | tagged class union | Preserve constructor identity and payload types. |

Rust, C, C++, and future WASI backends consume the same widths, cases, and ownership from the IR. Their surface types follow their own package and resource conventions. Conformance vectors prove that two backends observe the same portable values and reject the same invalid inputs.

## Semantic object projection

Copied Lean records and supported inductives project as ordinary value types: TypeScript interfaces/readonly values and Python dataclasses or typed records. Constructor tags, pointer layouts and boxed representations remain internal.

Identity-bearing Lean values project as canonical native-feeling classes/resources. Generated bindings provide constructors or factories, properties, instance/static methods, iteration, async methods, equality/identity policy and host-idiomatic lifecycle (`using`/`dispose` or context managers). If the same live Lean object crosses the boundary twice, the host receives the same live wrapper object.

Host objects exposed to Lean use the symmetric declared model: classes, constructors, receivers, properties, methods, callbacks, iterators and async operations. The public model does not require opaque handles plus free helper functions. Dynamic object access remains an explicit unsafe/advanced escape hatch.

## CI acceptance

CI inspects package export maps, generated `.d.ts`/`.pyi`, documentation and clean consumer fixtures. The ordinary public surface fails if it exposes:

- generic dispatch, `ccall` or `cwrap`;
- raw WebAssembly types, URLs or loader settings;
- underscored ABI symbols or calling-convention/signature flags;
- pointer-shaped or numeric handle APIs;
- public `any` or an untyped object escape presented as the normal path;
- retain/release helpers instead of host-language resource conventions; or
- consumer-written wrappers needed to perform a normal call.

Positive fixtures import and call named functions, construct and use objects, preserve identity across round trips, await methods, iterate, receive idiomatic errors and release resources. JavaScript and Python host projections share canonical declaration, semantic, proof and artifact identities even when their surface syntax differs.
