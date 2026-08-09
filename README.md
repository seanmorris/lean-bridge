# Lean Bridge

Lean Bridge turns Lean libraries into ordinary packages for JavaScript, Python, Rust, C, and C++. It keeps functions, rich values, ownership rules, theorem evidence, generated bindings, and exact build inputs connected to the artifacts that developers install.

The goal is to close the gap between research and implementation. A useful algorithm should be able to move from a Lean file with machine-checked properties into an application dependency graph without every consumer rebuilding the foreign-function boundary, packaging, and safety review.

```text
Lean source and theorems
          ↓
analyze, generate, build, rebuild, compare
          ↓
Wasm or native artifacts plus typed host bindings
          ↓
npm, PyPI, Cargo, Nix, C, and C++ packages
          ↓
import, call, done
```

The current repository is an architecture-testing proof of concept. It already proves the shared-runtime, native JavaScript projection, locked composition, and reproducible build foundations described in [Current status](#current-status). The package generator and public registry releases are the next product layer.

## Why installable verified components matter

Application teams already make a safety decision when they choose a package. Lean Bridge makes the component with stronger evidence the easy package to choose.

A release can fail before publication when:

- a theorem no longer checks against the implementation;
- a generated binding drifts from its Lean declaration;
- an ownership rule is missing or unsafe;
- two packages require incompatible runtimes or symbols;
- the proof metadata names a different artifact; or
- a clean rebuild produces different bytes.

The downstream developer still writes a normal import. One maintained package replaces many handwritten wrappers, one-off Wasm loaders, copied algorithms, and project-specific lifetime protocols.

Each published component is designed to carry the following connected records:

| Record | Question it answers |
|---|---|
| Lean declaration and implementation | What code runs? |
| Theorems and assumptions | What behavior has been checked? |
| Binding IR and generated host API | How does another language call it safely? |
| Capsule and semantic lock | Which components, targets, and contracts compose? |
| Nix closure and provenance | Which inputs built the artifact? |
| Artifact hashes and rebuild report | Did two clean builds produce the same release? |

This creates a reusable review boundary. Maintainers prove and package a component once. Applications consume the same checked boundary through the package manager they already use.

## Publish a Lean library

Most Lean source should need no bridge-specific annotation. The analyzer reads ordinary declarations, types, effects, documentation, theorem links, and build metadata. It asks for an adapter hint only when ownership, representation, or a foreign capability cannot be inferred safely.

```lean
namespace Acme.Limits

/-- Return `value` or the supplied upper limit, whichever is smaller. -/
def cap (limit value : Nat) : Nat :=
  Nat.min limit value

/-- Every result produced by `cap` is within the requested limit. -/
theorem cap_le_limit (limit value : Nat) : cap limit value ≤ limit := by
  exact Nat.min_le_left limit value

end Acme.Limits
```

The publishing workflow is designed around three commands:

```sh
lean-bridge analyze
lean-bridge build
lean-bridge publish --dry-run
```

`analyze` reports the discovered API, inferred host types, theorem coverage, ownership decisions, and any missing documentation or adapter hints. `build` produces the compiled library, binding IR, host bindings, types, docs, manifests, proof metadata, provenance, and flake output. `publish` rebuilds in an independent clean environment and blocks on any artifact difference before sending packages to configured registries.

Lean declarations remain the source of truth. Contributors do not maintain separate TypeScript declarations, Python stubs, C headers, Rust signatures, package docs, and validation schemas by hand.

## Consume the same component from ordinary code

The generator projects one portable contract into each host language. Package names below show the intended published surface.

### JavaScript and TypeScript

```ts
import { cap } from "@acme/limits";

const visibleRows = cap(100n, BigInt(rows.length));
```

`Nat` remains an arbitrary-precision integer. The generated TypeScript API uses `bigint` instead of narrowing the value through a JavaScript `number` or a JSON representation.

### Python

```python
from acme_limits import cap

visible_rows = cap(100, len(rows))
```

Python receives the same mathematical integer through its native `int` type.

### Rust

```rust
use acme_limits::cap;
use num_bigint::BigUint;

let visible_rows = cap(BigUint::from(100u32), rows.len().into());
```

### C++

```cpp
#include <acme/limits.hpp>

auto visibleRows = acme::limits::cap(
    lean_bridge::Nat{100},
    lean_bridge::Nat{rows.size()}
);
```

Each backend consumes the same language-neutral binding IR. A backend defines host spelling and lifecycle conventions. It does not reinterpret the Lean declaration or create a second source of binding semantics.

## What a theorem adds for a web developer

TypeScript can establish that `cap` accepts and returns `bigint`. The theorem `cap_le_limit` establishes a behavioral contract: for every natural-number input, the result cannot exceed the supplied limit.

Tests can sample calls such as `cap(100n, 143n)`. Lean checks the theorem for the full input domain described by the theorem. If a contributor changes `cap` in a way that violates the claim, the proof stops compiling and the release pipeline stops.

Generated package documentation connects the claim to:

- the exported function;
- the theorem that supports it;
- the theorem's assumptions and axioms;
- the Lean and bridge toolchain versions;
- the generated wrapper and ABI symbol; and
- the final artifact hash.

The package reports three assurance states:

| State | Meaning |
|---|---|
| proved | Named Lean theorems establish the stated property under recorded assumptions. |
| trusted boundary | The claim depends on a compiler, bridge, runtime, host API, foreign library, or axiom that remains outside the proof. |
| unverified | The code is usable, but the package attaches no machine-checked behavioral claim. |

These states keep the useful claim precise. A proved sorting property does not imply that the browser, network, UI, or every dependency has been proved correct.

## Values cross the boundary as values

Lean Bridge uses generated marshaling code and typed handles. It does not route calls through JSON. The target mapping preserves the source type's range, cases, field structure, and identity semantics.

| Lean type | TypeScript | Python | Boundary behavior |
|---|---|---|---|
| `Bool` | `boolean` | `bool` | Direct scalar conversion. |
| `UInt8`, `UInt16`, `UInt32` | validated `number` | validated `int` | Range is checked at the generated boundary. |
| `UInt64` | `bigint` | `int` | Full 64-bit range is preserved. |
| `Nat`, `Int` | `bigint` | `int` | Arbitrary precision is preserved. |
| `Float`, `Float32` | `number` | `float` | IEEE value conversion follows the declared width. |
| `String` | `string` | `str` | UTF-8 is copied directly, without a JSON encoder. |
| `ByteArray` | `Uint8Array` | `bytes` or `memoryview` | Copy is the default. A zero-copy view requires an explicit lifetime contract. |
| `Array T` | `readonly T[]` | `Sequence[T]` | Elements use the generated mapping for `T`. |
| `Option T` | generated tagged union | generated tagged union | Nested options retain every `none` and `some` distinction. |
| `Except E T` | typed result or generated exception policy | typed result or generated exception policy | Error cases remain structured and versioned. |
| structure | generated interface or value class | dataclass or value class | Fields retain their names and generated types. |
| inductive type | discriminated union | tagged class union | Constructor identity and payload types remain explicit. |
| identity-bearing object | generated class | generated resource class | One canonical wrapper refers to one retained Lean identity. |

Copied values and retained objects use different protocols. A copied record becomes an ordinary host value. A retained Lean object becomes a class with generated methods and deterministic disposal. Consumers never pass reference-count flags or numeric handles.

The current POC exercises the retained-object path with a Lean `Box` containing a `UInt32` and a persistent `String`. Three independently compiled libraries observe the same object identity while JavaScript uses `new Box(42)`, `box.read()`, `box.identity()`, and `box.dispose()`.

```ts
const box = new alpha.Box(42);
const sameBox = box.identity();

console.assert(sameBox === box);
box.dispose();
```

The bridge stores the Lean pointer in its shared registry and gives the generated wrapper a private token containing a side, nominal kind, slot, and generation. Reused slots receive a new generation, so a disposed token cannot name a later object. The wrapper also carries a private runtime identity. Wrong-class, wrong-runtime, disposed, and stale uses fail before Lean runs. Explicit disposal controls correctness. Garbage collection only queues fallback cleanup. [The registry evidence](docs/evidence/generation-safe-registries.md) records the ownership matrix and misuse tests.

It also sends a copied Lean record containing `Bool`, `UInt32`, `String`, `ByteArray`, and `Array UInt32` through a private typed frame. Lean changes the boolean and count, then JavaScript receives a new native record:

```ts
const output = alpha.roundTrip({
  enabled: true,
  count: 41,
  label: "Lean λ",
  bytes: new Uint8Array([0, 128, 255]),
  values: [0, 1, 0xffff_ffff],
});

// {
//   enabled: false,
//   count: 42,
//   label: "Lean λ",
//   bytes: Uint8Array(3) [0, 128, 255],
//   values: [0, 1, 4294967295]
// }
```

The wrapper checks numeric ranges and copy limits, allocates a temporary boundary arena, copies each typed field directly, and frees every allocation before returning. [The typed-value evidence](docs/evidence/typed-value-frame.md) records the ABI and failure behavior.

## One runtime for the application

Fifty libraries should not create fifty Lean heaps and fifty copies of the runtime. An application owns one Lean runtime, one heap, one WebAssembly memory, one function table, one symbol space, and one initialization domain.

Independently compiled libraries ship as runtime-free Wasm side modules. The loader resolves their transitive dependencies and links them into the existing application runtime. A final-static profile consumes the same locked graph and links one application Wasm artifact.

```ts
const statistics = await libraries.load(statisticsPackage);
const result = statistics.mean([1, 2, 3]);
```

`load` returns the generated API object. Emscripten handles, underscore-prefixed symbols, `ccall`, memory objects, and reference counts remain private.

This model follows the dynamic-library architecture proven by [PHP-Wasm](https://github.com/seanmorris/php-wasm) and the native cross-language ergonomics explored by [Vrzno](https://github.com/seanmorris/vrzno).

## Reproducible releases

The release pipeline treats reproducibility as an authorization step:

```text
analyze → generate → build A → clean build B → compare → report → publish
```

The default path uses a pinned Debian Docker environment. Native Nix provides the supported fallback. Build A and build B use clean source trees and separate writable state. The comparison covers binaries, bindings, types, docs, manifests, schemas, proof metadata, package projections, and provenance inputs.

Any difference blocks publication. The release receives machine-readable and human-readable reports with both hashes, differing paths, likely entropy categories, and exact reproduction commands. Registry credentials remain unavailable until the comparison passes.

The current POC passes this gate for 24 browser artifacts and 24 threaded artifacts across independent checkout roots. The generated C ABI header is part of each comparison. The complete x86-64 build also runs inside Nix from fixed Lean, libuv, Emscripten, Node, and source inputs.

## Current performance evidence

`npm run benchmark:poc` measures the public native JavaScript `Box` API. The run below used Node 22.23.1 on an Intel Core i7-7700K with eight logical CPUs. It measured 12 cold samples, 600,000 warm reads, and 60,000 warm construct, read, and dispose cycles.

| Operation | Median | p95 |
|---|---:|---:|
| create the browser-profile main module | 9.49 ms | 18.37 ms |
| verify and lazy-load Alpha | 1.11 ms | 6.94 ms |
| first `Box` construct, read, and dispose | 1.46 ms | 49.43 ms |
| warm `box.read()` | 45.3 ns | 256.0 ns |
| warm construct, read, and dispose | 1.604 µs | 7.412 µs |

The first `Box` operation includes deferred Lean runtime initialization. The benchmark uses a warm filesystem cache under Node and does not measure browser download or compilation. Alpha's public class projection and resource lifecycle plan come from Binding IR. Its private symbol map remains a POC input until the Lean frontend emits it. [The benchmark record](docs/evidence/performance.md) includes artifact hashes, method, size results, and limitations.

Current browser-profile artifact sizes:

| Artifact | Bytes |
|---|---:|
| lazy main module with one Lean runtime and `Init` | 1,294,472 |
| Alpha lazy side module | 3,778 |
| Beta lazy side module | 604 |
| Gamma lazy side module | 605 |
| final-static three-library application | 1,294,401 |

These measurements establish a POC baseline. The production suite will add primitive and structured-value marshaling, callbacks, promises, browser startup, memory, 1/3/10/50-library slopes, and comparisons against standalone runtime copies.

## Current status

The architecture-testing POC has established:

- one real Lean runtime shared by three independently compiled Lean libraries;
- one retained Lean object passed across all three libraries without losing identity;
- startup, lazy dynamic, and final-static composition from one content-addressed graph;
- a native JavaScript class projection with generation-safe private tokens, canonical identity, deterministic disposal, fallback finalization, and runtime epoch checks;
- browser and threaded memory profiles;
- artifact integrity, version, symbol, initialization, and graph conflict checks;
- 104 passing behavioral and structural tests;
- byte-identical browser and threaded artifacts across independent roots; and
- a complete fixed-input x86-64 Nix build.

The POC now generates its JavaScript class, function, TypeScript declarations, validators, documentation, package manifest, copied-record frame layout, matching C frame header, resource lifecycle plan, and pending-operation plan from the canonical binding IR. The shared runtime enforces exactly-once pending settlement, reverse cleanup, cancellation, late-settlement rejection, capacity, and shutdown. [The pending-operation evidence](docs/evidence/pending-operation-state-machine.md) separates this passing state-machine result from the remaining Wasm Promise and callback adapter work. Remaining product work includes Lean runtime object lowering, additional numeric and inductive mappings, zero-copy leases, JavaScript callbacks and asynchronous re-entry, generated npm and downstream-language packages, bundler and browser fixtures, the 50-library performance suite, and AArch64 toolchain support.

## Work on the project

Node 22 or newer runs the tests and POC tools. The Nix path reproduces the fixed x86-64 toolchain and complete build.

```sh
npm run bootstrap
npm test
npm run test:reproducibility
npm run test:nix
npm run benchmark:poc
```

Contributors should start with [CONTRIBUTING.md](CONTRIBUTING.md). The [architecture index](docs/architecture/README.md) contains the binding, runtime, composition, risk, and POC documents. Verified implementation results live under [docs/evidence](docs/evidence).

The [historical synthesis](docs/vision.md) explains how proof-carrying code, typed WebAssembly components, supply-chain provenance, reproducible builds, and proof-aware package management lead to this design.

## Architecture requirements

Every implementation decision must preserve these properties:

1. One composed application has one Lean runtime and one ownership domain.
2. Lean declarations and binding metadata generate every public host API.
3. Consumers call native functions and classes without raw Wasm or ABI knowledge.
4. Types, errors, ownership, asynchronous work, and proof metadata compose across independently built packages.
5. A canonical lock identifies source, proof, toolchain, graph, target, wrapper, and artifact.
6. Clean rebuild comparison blocks a non-reproducible release.
7. JavaScript receives first-class support without making the core JavaScript-only.
8. Accessibility, diagnostics, install time, and time to first call are release criteria.

Architecture documents use `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` as defined by [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Primary references

- [Vrzno](https://github.com/seanmorris/vrzno)
- [PHP-Wasm](https://github.com/seanmorris/php-wasm)
- [PHP-Wasm extension loading](https://php-wasm.seanmorr.is/extensions/using-php-extensions.html)
- [Lean 4](https://github.com/leanprover/lean4)
- [Lean Language Reference](https://lean-lang.org/doc/reference/latest/)
- [Lean foreign-function interface](https://lean-lang.org/doc/reference/latest/Runtime-Code/Foreign-Function-Interface/)
- [Emscripten dynamic linking](https://emscripten.org/docs/compiling/Dynamic-Linking.html)
- [WebAssembly Component Model](https://github.com/WebAssembly/component-model)
