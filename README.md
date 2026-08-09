# Lean Bridge

Lean Bridge turns Lean libraries into ordinary packages for JavaScript, PHP, Python, Rust, C, and C++. It keeps functions, rich values, ownership rules, theorem evidence, generated bindings, and exact build inputs connected to the artifacts that developers install.

The goal is to close the gap between research and implementation. A useful algorithm should be able to move from a Lean file with machine-checked properties into an application dependency graph without every consumer rebuilding the foreign-function boundary, packaging, and safety review.

```text
Lean source and theorems
          ↓
analyze, generate, build, rebuild, compare
          ↓
Wasm or native artifacts plus typed host bindings
          ↓
npm, Composer, PyPI, Cargo, Nix, C, and C++ packages
          ↓
import, call, done
```

The current repository is an architecture-testing proof of concept. It already proves the shared-runtime, native JavaScript and PHP projections, locked composition, reproducible build foundations, and an installable npm package described in [Current status](#current-status). Registry publication and broader target coverage are the next product layer.

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
lean-bridge publish --dry-run --output build/reproducibility-gate
```

`analyze` reports the discovered API, inferred host types, theorem coverage, ownership decisions, and any missing documentation or adapter hints. `build` produces the compiled library, binding IR, host bindings, types, docs, manifests, proof metadata, provenance, and flake output. `publish` rebuilds in an independent clean environment and blocks on any artifact difference before sending packages to configured registries.

Lean declarations remain the source of truth. Contributors do not maintain separate TypeScript declarations, PHP or Python stubs, C headers, Rust signatures, package docs, and validation schemas by hand.

## Consume the same component from ordinary code

The generator projects one portable contract into each host language. Package names below show the intended published surface.

### JavaScript and TypeScript

```ts
import { cap } from "@acme/limits";

const visibleRows = cap(100n, BigInt(rows.length));
```

`Nat` remains an arbitrary-precision integer. The generated TypeScript API uses `bigint` instead of narrowing the value through a JavaScript `number` or a JSON representation.

The current Alpha POC builds and installs as a real Node 22 ESM package:

```sh
nix --extra-experimental-features 'nix-command flakes' build .#npm-package
npm install ./result/lean-bridge-alpha-0.0.0.tgz
```

```ts
import { Box, roundTrip } from "@lean-bridge/alpha";

const box = new Box(42);
console.assert(box.identity() === box);
box.dispose();
```

The package uses literal Wasm asset URLs for static discovery and keeps its loader behind a closed export map. The current release tarball targets Node. The browser profile passes raw ESM, module worker, Vite, Rollup, Webpack, and React Strict Mode tests against the same native API and shared-runtime contract. Browser conditional exports remain required before the npm release can claim both hosts. [The browser acceptance record](docs/evidence/browser-bundler-acceptance.md) includes the pinned matrix, configuration, and first-call measurements.

### PHP

```php
use LeanAlpha\Box;

$box = new Box(41);
$value = $box->read();
$box->close();
```

The generated Composer package exposes namespaced functions, typed value objects, canonical resource classes, callables, exceptions, and static-analysis stubs. A native Zend adapter and a PHP-Wasm adapter implement one private typed transport interface. PHP application code sees neither transport calls nor runtime identities.

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

### C

```c
#include <lean_alpha.h>

lean_alpha_error error = {0};
lean_alpha_box *box = NULL;
uint32_t value = 0;

if (lean_alpha_box_create(41, &box, &error) == LEAN_ALPHA_STATUS_OK) {
    lean_alpha_box_read(box, &value, &error);
}

lean_alpha_box_dispose(&box);
```

The generated C header exposes prefixed functions, copied value structs, typed spans, callbacks, status values, and opaque owned resources. The runtime package installs a generated internal adapter before application code starts. Application code never passes a runtime handle or calls a generic dispatcher.

Each backend consumes the same language-neutral binding IR. A backend defines host spelling and lifecycle conventions. It does not reinterpret the Lean declaration or create a second source of binding semantics.

### WIT and WASI hosts

```wit
package poc:lean-alpha@0.0.0;

interface types {
  record payload {
    enabled: bool,
    count: u32,
    label: string,
    bytes: list<u8>,
    values: list<u32>,
  }

  enum bridge-error {
    disposed-resource,
  }

  resource box {
    constructor(value: u32);
    read: func() -> result<u32, bridge-error>;
  }
}
```

`npm run generate:wit` emits a validated Component Model interface for the portable Alpha subset and a Python name map from the same Binding IR hash. A separate consumer package imports the provider's nominal `box` resource instead of defining a lookalike handle. First-class callbacks and receiver-anchored borrowed results remain explicit capability gaps. [The WIT projection evidence](docs/evidence/wit-projection.md) records the generated contract and independent composition check.

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

| Lean type | TypeScript | PHP | Python | Boundary behavior |
|---|---|---|---|---|
| `Bool` | `boolean` | `bool` | `bool` | Direct scalar conversion. |
| `UInt8`, `UInt16`, `UInt32` | validated `number` | validated `int` | validated `int` | Range is checked at the generated boundary. |
| `UInt64` | `bigint` | `BigInteger` | `int` | Full 64-bit range is preserved. |
| `Nat`, `Int` | `bigint` | `BigInteger` | `int` | Arbitrary precision is preserved. |
| `Float`, `Float32` | `number` | `float` | `float` | IEEE value conversion follows the declared width. |
| `String` | `string` | `string` | `str` | UTF-8 is copied directly, without a JSON encoder. |
| `ByteArray` | `Uint8Array` | `Bytes` | `bytes` or `memoryview` | Copy is the default. A zero-copy view requires an explicit lifetime contract. |
| `Array T` | `readonly T[]` | typed `list<T>` | `Sequence[T]` | Elements use the generated mapping for `T`. |
| `Option T` | generated tagged union | `T|null` when unambiguous, otherwise generation blocks | generated tagged union | Nested options retain every `none` and `some` distinction. |
| `Except E T` | typed result or generated exception policy | generated exception policy | typed result or generated exception policy | Error cases remain structured and versioned. |
| structure | generated interface or value class | readonly value object | dataclass or value class | Fields retain their names and generated types. |
| inductive type | discriminated union | tagged value classes | tagged class union | Constructor identity and payload types remain explicit. |
| identity-bearing object | generated class | generated resource class | generated resource class | One canonical wrapper refers to one retained Lean identity. |

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

Functions cross the boundary as functions. Alpha calls the supplied JavaScript transform from Lean, then resumes Lean before returning the result:

```ts
const answer = alpha.withCallback(40, value => value);

console.assert(answer === 42);
```

Lean adds one before invoking the transform and one after it returns. The generated binding retains the JavaScript function for the call, reuses its identity during nested calls, validates each `UInt32`, unwinds thrown JavaScript errors, and releases the function before returning. A callback may call Alpha again on the same agent. The runtime tracks that path with bounded nested frames. The public API contains no callback tokens, table indices, or manual adapters. [The callback evidence](docs/evidence/callback-signature-plan.md) records the complete call cycle and failure tests.

Lean closures cross in the other direction through the same generated signature:

```ts
const addTwo = alpha.makeAdder(2);

console.assert(addTwo(40) === 42);
addTwo.dispose();
```

`addTwo` is a JavaScript function. Its private Lean identity lives in the shared runtime. The generated callable validates arguments, participates in the same nested frame stack, exposes deterministic disposal, and queues fallback cleanup when JavaScript collects it. A JavaScript callback can call `addTwo` while Lean is waiting for that callback, so both directions compose in one synchronous call cycle.

## One runtime for the application

Fifty libraries should not create fifty Lean heaps and fifty copies of the runtime. An application owns one Lean runtime, one heap, one WebAssembly memory, one function table, one symbol space, and one initialization domain.

Independently compiled libraries ship as runtime-free Wasm side modules. The loader resolves their transitive dependencies and links them into the existing application runtime. A final-static profile consumes the same locked graph and links one application Wasm artifact.

```ts
const statistics = await libraries.load("statistics");
const result = statistics.mean([1, 2, 3]);
```

`load` returns the generated API object. Emscripten handles, underscore-prefixed symbols, `ccall`, memory objects, and reference counts remain private.

The performance POC applies that rule to three independently compiled Lean libraries:

```ts
const { SpatialIndex } = await libraries.load("spatial-index");
const analytics = await libraries.load("spatial-consumer");

const index = new SpatialIndex(2, [
  { id: 11, coordinates: new Int32Array([0, 0]) },
  { id: 12, coordinates: new Int32Array([0, 7]) },
]);

const nearest = index.nearest(new Int32Array([1, 0]));
const result = analytics.rangeChecksum(index, [0, 0], [2, 7]);

console.assert(nearest.squaredDistance === 1n);
console.assert(result.checksum === 23n);
index.dispose();
```

`SpatialIndex` is a generated JavaScript class. Its Lean identity stays private in a generation-safe `WeakMap`. Coordinates cross as signed 32-bit arrays, point IDs cross as unsigned 32-bit arrays, and squared distances and checksums cross as `bigint`. No call serializes the values through JSON. Loading `spatial-consumer` resolves its producer dependencies recursively and initializes each library once inside the existing Lean runtime.

The scaling suite repeats that architecture with 1, 3, 10, and 50 independently compiled Lean libraries. A composed 50-library graph uses one 17,039,360-byte Wasm memory. Giving those libraries isolated runtimes allocates 851,968,000 bytes across fifty memories. Each package still exposes an ordinary generated `ping` function. [The library scaling evidence](docs/evidence/library-scaling.md) records every artifact byte, initializer, profile, phase, and limitation.

This model follows the dynamic-library architecture proven by [PHP-Wasm](https://github.com/seanmorris/php-wasm) and the native cross-language ergonomics explored by [Vrzno](https://github.com/seanmorris/vrzno).

## Reproducible releases

The release pipeline treats reproducibility as an authorization step:

```text
analyze → generate → build A → clean build B → compare → report → publish
```

The default path uses a pinned Debian Docker environment. Native Nix provides the supported fallback. Build A and build B use clean source trees and separate writable state. The comparison covers binaries, bindings, types, docs, manifests, schemas, proof metadata, package projections, and provenance inputs.

Any difference blocks publication. The release receives machine-readable and human-readable reports with both hashes, differing paths, likely entropy categories, and exact reproduction commands. Registry credentials remain unavailable until the comparison passes.

The zero-configuration gate now clones one committed source revision twice, gives each build separate writable state, compares every file and mode under the canonical bundle and package projections, and writes a content-addressed authorization for the exact matching inventory. A failed comparison retains JSON and Markdown diagnostics but cannot produce an authorization. [The release gate evidence](docs/evidence/reproducibility-release-gate.md) records the contract and verification commands. The POC also passes its earlier cross-root gate for 24 browser artifacts and 24 threaded artifacts. The PHP release gate rebuilds 48 native files and 63 files for each PHP-Wasm profile, compares every byte, verifies both hash inventories, executes one semantic corpus through all three profiles, then runs the two-component shared-runtime test. [The PHP release gate evidence](docs/evidence/php-release-gate.md) records the 174-file result.

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

`npm run benchmark:php` measures the same generated PHP API through native Zend and both PHP-Wasm loading profiles. On the same machine, native warm reads measured 179.5 ns per call. PHP-Wasm lazy and startup measured 1,728.4 ns and 1,579.7 ns. Typed copied-record throughput measured 580,685 calls per second natively, 43,129 through lazy PHP-Wasm, and 46,496 through startup PHP-Wasm. The lazy profile spent 25.716 ms on its first Beta call because that call loads the independently compiled component into the existing runtime. The startup profile spent 0.416 ms. Every profile finished with zero live identities. [The PHP transport benchmark](docs/evidence/php-transport-performance.md) records startup, first calls, callbacks, copied values, memory, cleanup, package sizes, and limitations.

The library scaling benchmark compiles fifty real Lean modules and runs 1, 3, 10, and 50-library graphs through lazy, startup, final-static, and isolated-runtime profiles. The composed profiles keep one 17,039,360-byte Wasm memory at every graph size. The fifty-runtime comparison allocates 851,968,000 bytes. The first timing record is a reporting check, not a baseline. [The scaling evidence](docs/evidence/library-scaling.md) includes phase timings, artifact sizes, cache state, and attribution limits.

The generated-call suite measures the API that application code receives. On the same machine, a retained Lean method measured 302 ns at the median, a returned Lean closure measured 421 ns, a JavaScript callback invoked by Lean measured 1.694 µs, and nested callback re-entry measured 5.322 µs. A record containing `Bool`, `UInt32`, `String`, `ByteArray`, and `Array UInt32` crossed the generated typed frame in 16.825 µs with eight array items. The bridge did not serialize it. Cancellation rejected 192 pending Promises and cleanup reached zero live resources, closures, callbacks, operations, and iterators. [The generated native call evidence](docs/evidence/native-call-overhead.md) records raw-sample summaries, first calls, artifact hashes, method, and limitations.

The lifecycle suite repeats generated object, closure, callback, copied-value, Promise, and iterator operations for 24 rounds. It reaches 256 live Lean resources, 32 live Lean closures, and 32 pending operations per round, then returns every registry to zero. Wasm memory remains at 17,039,360 bytes across 50 snapshots. Disposed, cross-runtime, and shutdown-expired wrappers fail with specific boundary errors. [The lifecycle stability evidence](docs/evidence/lifecycle-stability.md) records high-water state, retained state, deterministic delayed-finalizer behavior, process memory, and exact artifact identities.

The performance reproducibility gate rebuilds the spatial and 50-library suites in two independent clean trees. Both 385-file inventories contain 17,838,911 bytes and produce the same SHA-256. A separate three-run check executes one fixed workload through all four loading profiles. Every run produces the same semantic digest while the report preserves variance for 62 timing metrics. [The performance reproducibility evidence](docs/evidence/performance-reproducibility.md) records the exact scope, hashes, exclusions, commands, and observed timing spread.

The approved measurement methodology requires nine valid fresh-process forks on an identified runner. It retains every sample from valid forks and calculates deterministic 95 percent confidence intervals from 10,000 fork-level bootstrap resamples. The pinned reference host can collect baselines. Shared CI stays informational because its CPU, kernel, co-tenant load, and power state can change between jobs. [The performance methodology](docs/evidence/performance-methodology.md) defines timed regions, cache profiles, noise rejection, memory collection, comparison identity, and accessible reporting.

The performance budget pipeline runs the generated APIs in nine fresh processes and produces one versioned result vector. It covers startup, first calls, warm calls, callbacks, Promises, allocation and disposal, cross-library handoff, authoritative memory, and 1, 3, 10, and 50-library composition. Every metric receives a hard ceiling and a relative threshold. Missing metrics fail. Relative regressions fail only when the change exceeds the practical threshold and the 95 percent confidence intervals no longer overlap. Baseline history retains the reviewer, rationale, source revision, file path, and SHA-256. [The performance budget evidence](docs/evidence/performance-budgets.md) defines collection, review, comparison, and failure reporting.

The complete performance workflow publishes those evidence families in one GitHub Actions summary on every push. It reports each job's elapsed time, disk use, toolchain footprint, build footprint, evidence size, and cache state so the project can split the workflow using observed CI cost. Shared-runner timing stays informational. Missing measurements, failed correctness, semantic drift, source disagreement, artifact hash drift, and nonreproducible builds fail closed. The accepted archive now carries the exact measured Wasm, generated bindings, graph and build inputs, raw records, accessible tables, schemas, and a property-index projection under one immutable evidence identity. Complexity records retain `proved`, `asserted`, or `unknown`; measured compiled-artifact timings remain a separate claim type. [The CI performance evidence contract](docs/evidence/performance-ci.md) defines the bundle, validation rules, and failure policy.

Current browser-profile artifact sizes:

| Artifact | Bytes |
|---|---:|
| lazy main module with one Lean runtime and `Init` | 1,296,987 |
| Alpha lazy side module | 4,612 |
| Beta lazy side module | 604 |
| Gamma lazy side module | 605 |
| final-static three-library application | 1,300,218 |

Current native PHP artifact sizes:

| Artifact | Bytes |
|---|---:|
| shared Lean runtime and `Init` | 14,048,976 |
| generated Alpha Zend extension | 249,064 |
| independent probe extension | 54,368 |

Current Nix native PHP release sizes:

| Artifact | Bytes |
|---|---:|
| stripped shared Lean runtime and `Init` | 13,753,112 |
| stripped generated Alpha Zend extension | 64,944 |

Current PHP-Wasm package sizes:

| Artifact | Bytes |
|---|---:|
| shared Lean runtime and `Init` | 8,913,483 |
| generated lazy PHP 8.4 extension | 28,489 |
| generated startup PHP 8.4 extension | 25,162 |
| Alpha side module | 4,658 |
| Beta side module | 632 |
| Gamma side module | 633 |

The lazy extension carries Asyncify support because its first Beta call loads the side module without exposing a loader to PHP.

These measurements establish a POC baseline. The production suite will add Promise latency, browser startup, per-instance host RSS, 1/3/10/50-library slopes, and comparisons against standalone runtime copies.

## Current status

The architecture-testing POC has established:

- one real Lean runtime shared by three independently compiled Lean libraries;
- one retained Lean object passed across all three libraries without losing identity;
- startup, lazy dynamic, and final-static composition from one content-addressed graph;
- a native JavaScript class projection with generation-safe private tokens, canonical identity, deterministic disposal, fallback finalization, and runtime epoch checks;
- a native JavaScript callback projection with canonical function identity, bounded nested re-entry, exception unwinding, and deterministic call-scoped release;
- exported Lean closures projected as native JavaScript functions with canonical weak identity, deterministic disposal, queued finalization, and the same nested frame rules;
- a generated scalar error envelope that returns copied values, projects declared failures as native error classes, and contains unexpected failures according to the declared policy;
- generated scalar iterators with lazy native pulling, standard synchronous and asynchronous iteration, cancellation, and deterministic completion or early-return cleanup;
- generated native properties with ordinary getter and setter syntax, TypeScript mutability, receiver lifetime checks, and no public helper methods;
- generated arity-based overloads with one JavaScript callable, multiple TypeScript signatures, and ambiguity rejection before projection;
- generated first-call initialization plans with canonical Binding IR identity, exactly-once execution, terminal failure, and no hidden retry;
- generated finite generic projections with concrete TypeScript signatures, native value dispatch, and no public type tokens;
- a generated C11 package surface with typed copied records, direct functions, opaque resources, callbacks, explicit disposal, status conventions, and finite generic monomorphization;
- a generated Rust crate with owned copied values, receiver-anchored borrows, `Result` errors, closure parameters, `Drop` cleanup, and finite generic monomorphization;
- a generated Python package with frozen value dataclasses, native functions and callables, context-managed resources, exceptions, properties, iterators, async iterators, awaitables, and `.pyi` stubs;
- a WIT projection for portable copied records, resources, and functions with the exact Binding IR hash, a Python consumer map, official parser validation, nominal cross-package resource identity, and explicit capability gaps;
- a generated Composer package with readonly copied values, namespaced functions, canonical resources, native callables, exceptions, properties, iterators, awaitables, deterministic close, and PHP stubs;
- a generated native Zend adapter that compiles against the C transport, auto-connects to the Composer package, preserves typed copied values and canonical identities, and retains PHP callback exceptions as declared failure causes;
- one PIC native Lean runtime and identity domain shared by two independently compiled and loaded PHP extensions, with one runtime initialization and two component initializations;
- one manifest-driven native PHP release containing the shared runtime, generated extension, Composer package, reflection, assurance data, provenance inputs, and artifact hashes;
- one generated PHP-Wasm adapter that emits the flat locked runtime and component closure through PHP-Wasm's existing package hooks, imports maintained Weaker for Vrzno-compatible weak identity, and reuses the native PHP projection, Zend handlers, C ABI, and component provider;
- one manifest-driven PHP-Wasm release built with the host's locked Emscripten ABI, containing one shared runtime, three capsule-locked components, a PHP 8.4 extension, Composer sources, provenance, and artifact hashes;
- one published PHP-Wasm host execution that preserves retained identity and typed copied values, invokes callbacks and Lean closures, initializes the runtime once, and finishes with zero live identities;
- one generated cross-package PHP call surface where Beta reads an Alpha object and returns its canonical PHP wrapper, with no public handle or dispatcher;
- startup and first-call lazy PHP-Wasm profiles that attach Alpha and Beta to one runtime, memory, table, Lean heap, initialization domain, and PHP identity domain;
- one Binding IR-derived PHP conformance corpus that executes unchanged through native Zend and PHP-Wasm, producing the same typed values, identity, callback, closure, failure, reflection, documentation, assurance, initialization, and cleanup observations;
- one allowlisted Nix compilation boundary that excludes binding and packaging backends from the core artifact derivation;
- one content-addressed release bundle with 78 inventoried artifacts, five generated binding backends, an executable validator, assurance metadata, an SPDX SBOM, in-toto provenance, and a canonical package manifest;
- one deterministic npm tarball that installs into a clean Node project and exposes generated classes and functions through a closed package export map;
- one browser acceptance matrix where raw ESM, a module worker, Vite, Rollup, Webpack, and React Strict Mode load an independently compiled Lean side module through one lazy runtime;
- one compiler-free Cargo projection that emits deterministic crates for eligible Rust targets and blocks the current bundle because its native component and runtime adapter are absent;
- one compiler-free PyPI projection that emits deterministic wheels and source archives for eligible Python targets and blocks the current bundle because its native extension adapter is absent;
- one compiler-free C package projection that emits deterministic archives with pkg-config and CMake discovery for eligible targets, while C and C++ publication remain blocked by explicit native artifact and binding capability gaps;
- one no-publish release rehearsal that invokes every eligible backend, records explicit omissions, and emits a canonical publication index plus an in-toto statement tied to one bundle identity;
- one clean-install gate that runs npm and C consumers through ordinary APIs, accounts for every installed package file, compares their public `Box` behavior, and executes packaging with child processes disabled;
- one installed `lean-bridge` CLI contract with noninteractive `analyze`, `build`, `publish`, JSON agent output, and an operational no-publish dry run;
- one read-only project analyzer that validates an existing Binding IR or proposes a deterministic contract for copied primitive values, preserves theorem links as unverified evidence, and blocks ambiguous ownership or effect boundaries;
- one Docker-first canonical build command with immutable Debian and Nix base images, a hash-locked builder definition, read-only source staging, native Nix fallback, and validated bundle plus package output;
- one hard reproducibility gate that builds a committed source revision twice in independent writable environments, compares the full release inventory, retains bounded failure diagnostics, and authorizes only the exact matching candidate;
- one versioned spatial performance corpus with 2D, 4D, and 8D search contracts, evidence-scoped complexity claims, frozen correctness vectors, retained index identity, cross-component borrowing, and disposal semantics;
- one 1, 3, 10, and 50-library scaling suite built from real Lean modules, with lazy, startup, final-static, and isolated-runtime profiles;
- one generated-call overhead suite covering retained methods, typed copied records, batching, identity reuse, callbacks, nested re-entry, iterators, Promises, cancellation, exceptions, and cleanup;
- one 24-round lifecycle stability suite with registry high-water marks, zero retained bridge state, stable Wasm pages, deterministic delayed-finalizer checks, and explicit cross-runtime and shutdown rejection;
- one independent two-root performance rebuild covering 385 files, plus a three-run semantic consistency check with 62 separately reported timing metrics;
- one versioned measurement methodology with a pinned reference host, nine-fork sampling, deterministic uncertainty, whole-fork noise rejection, and an explicit informational shared-CI class;
- browser and threaded memory profiles;
- artifact integrity, version, symbol, initialization, and graph conflict checks;
- reviewed JavaScript, PHP, Python, C, and Rust package reports with deterministic regeneration, file hashes, export maps, capability gaps, and forbidden-public-surface gates;
- named lazy and prelinked loading that returns the same frozen API shape while keeping catalog, linker, and ABI state private;
- 358 passing behavioral and structural tests. The earlier 311-test architecture seam has a complete [JUnit review record](docs/evidence/test-suite-1e26785.md);
- byte-identical browser and threaded artifacts across independent roots; and
- complete fixed-input x86-64 Nix builds for the Wasm POC, immutable universal core, universal release bundle, npm package, and native PHP package.

The POC now generates its JavaScript class, functions, callback type, TypeScript declarations, Composer package and PHP stubs, native Zend adapter, PHP-Wasm side-module adapter, process-owned runtime provider, Python package and stubs, C11 package, Rust crate, WIT interface probe, validators, documentation, manifests, copied-record frame layout, resource lifecycle plan, pending-operation plan, and callback signature plan from the canonical binding IR. One reviewed gate locks every generated package file and rejects export, type, documentation, generator, hash, or capability drift. A second gate compiles one semantic contract for callable shape, generic instantiation, copied and identity values, mutability, ownership, errors, delivery modes, documentation, and assurance provenance, then verifies every target package against that contract. Named dynamic and prelinked loads now return the same generated API object. Consumer conformance tests call functions, classes, callbacks, closures, and typed values without accessing the linker or private ABI. [The direct-call conformance evidence](docs/evidence/direct-call-conformance.md) records that boundary. The C, Rust, Python, and PHP packages execute against generated per-declaration runtime interfaces with no consumer wrapper code. The Zend adapter implements that interface through compiled C and automatic Composer discovery. Its native integration test links two independently compiled PHP extensions to one real Lean runtime and one identity domain. The native release test rebuilds the entire package twice, executes it through PHP CLI and two server requests, then verifies the Nix output. [The native PHP release evidence](docs/evidence/native-php-release-package.md) records that gate. The PHP-Wasm generator flattens the locked capsule graph into the existing PHP-Wasm `getLibs` and `getFiles` shape, prepares maintained Weaker through the Emscripten module arguments, and adds request generation checks to the shared Zend source. The composition gate loads Alpha and Beta through eager and lazy profiles, passes one retained value between them, checks canonical PHP identity, and audits every module for one imported memory and table. [The PHP-Wasm shared runtime composition evidence](docs/evidence/php-wasm-shared-runtime-composition.md) records that result. The WIT probe projects portable records, resources, and functions without changing the JavaScript package or assurance identities. It validates an independently generated consumer against the provider's nominal resource identity. [The WIT projection evidence](docs/evidence/wit-projection.md) records the interface boundary. The flake now separates the compiler input from all package projection code, then assembles the resulting runtime and components with five generated binding packages and release evidence. The npm projection consumes that bundle without compiler access, preserves every compiled core byte, and produces a deterministic tarball that passes a clean install test. The Cargo, PyPI, and C family projections use the same compile-free backend policy and refuse to produce misleading releases when canonical runtime or binding artifacts are absent. The no-publish rehearsal invokes every eligible backend from one bundle and binds its local archives and projection plans into one attestable index. The clean-install gate runs npm and C consumers, compares their native API observations, and traces every installed file to canonical bytes or a reviewed backend derivation. The installed CLI provides real analysis, canonical build, and clean rebuild authorization workflows while keeping external publication blocked. [The analyzer evidence](docs/evidence/lean-project-analysis.md), [CLI contract evidence](docs/evidence/zero-config-cli-contract.md), and [reproducibility gate evidence](docs/evidence/reproducibility-release-gate.md) record those boundaries. [The universal release bundle evidence](docs/evidence/universal-release-bundle.md) records the exact compilation boundary. [The npm package evidence](docs/evidence/npm-package.md) records the install and call boundary. [The Cargo package evidence](docs/evidence/cargo-package.md), [PyPI package evidence](docs/evidence/pypi-package.md), [C family package evidence](docs/evidence/c-family-package.md), [release rehearsal evidence](docs/evidence/release-rehearsal.md), and [clean-install evidence](docs/evidence/release-install-gate.md) record deterministic archive paths, current publication gates, shared identities, and installed-file provenance. Rust represents copied records as owned values, receiver identity as a borrow, failures as `Result`, closure parameters as native callables, and cleanup as `Drop`. Python uses frozen dataclasses, context managers, normal callables, exceptions, properties, iterators, async iterators, and awaitables. PHP uses readonly value objects, canonical resource classes, callables, exceptions, properties, `Traversable`, awaitables, and deterministic `close()`. One JavaScript function returns a normal Promise, runs Lean after the initiating Wasm stack returns, and settles through the shared runtime. Another calls JavaScript from Lean, while `makeAdder` returns a Lean closure as an ordinary JavaScript function. A nested fixture crosses JavaScript to Lean, back to JavaScript, into a returned Lean closure, and back without creating another runtime. Cancellation, callback exceptions, explicit disposal, fallback finalization, and shutdown unwind their state without leaking retained values. Binding IR version 3 adds semantic variants, resource ownership for static members, and host object projection metadata. It migrates version 1 and version 2 documents before generation. JavaScript emits discriminated unions and native static methods. Python emits frozen tagged classes and static methods. Generated Lean host adapters preserve receiver ownership, lifetimes, callback boundaries, iterators, and asynchronous delivery without exposing private handles. [The semantic parity evidence](docs/evidence/cross-language-semantic-parity.md) records the shared contract. [The generated-package gate evidence](docs/evidence/generated-package-gate.md) records the byte-level release check. [The C backend evidence](docs/evidence/generated-c-backend.md), [Rust backend evidence](docs/evidence/generated-rust-backend.md), [Python backend evidence](docs/evidence/generated-python-backend.md), [PHP backend evidence](docs/evidence/generated-php-backend.md), [Zend adapter evidence](docs/evidence/generated-zend-adapter.md), [shared native PHP runtime evidence](docs/evidence/shared-native-php-runtime.md), and [PHP-Wasm adapter evidence](docs/evidence/php-wasm-side-module-adapter.md) record the generated surfaces and current runtime boundary. [The pending-operation evidence](docs/evidence/pending-operation-state-machine.md) records the asynchronous call cycle. [The callback evidence](docs/evidence/callback-signature-plan.md) records both synchronous directions. Remaining product work includes fresh elaborator-backed type extraction, additional numeric mappings, zero-copy leases, native Cargo, PyPI, and C runtime artifacts, a C++ binding projection, a Component Model binary adapter with WASI execution, approved performance methodology and budgets, ZTS PHP support, and AArch64 toolchain support.

## Work on the project

Node 22 or newer runs the tests and POC tools. The native PHP fixtures also require non-thread-safe PHP 8.2, PHP development headers, Composer, clang, clang++, patchelf, and the libuv and OpenSSL development packages. The Nix path supplies and fixes that x86-64 toolchain.

```sh
npm run bootstrap
npm run binding-packages
npm run binding-parity
npm run generate:wit -- --json
npm run test:php-native-package
npm run test:browser-bundlers
npm run test:performance-corpus
npm run test:performance-reference
npm run test:performance-wasm
npm run test:performance-workloads
npm run test:performance-overhead
npm run test:performance-lifecycle
npm run test:performance-reproducibility
npm run test:performance-methodology
npm run test:performance-budgets
npm run test:performance-ci
npm run benchmark:spatial -- --output build/performance-wasm/interactive-suite.json
npm run benchmark:scaling -- --output build/performance-scale/scaling-suite.json
npm run benchmark:overhead -- --output build/lean-link-spike/native-overhead-suite.json
npm run benchmark:lifecycle -- --output build/lean-link-spike/lifecycle-stability-suite.json
npm run verify:performance-reproducibility -- --output build/performance-reproducibility/build-comparison.json
npm run benchmark:self-consistency -- --repetitions 3 --output build/performance-reproducibility/self-consistency.json
npm run verify:performance-methodology -- --exclusive --network-disabled --output build/performance-methodology/reference.json
npm run benchmark:baseline -- --environment reference-linux-x64-i7-7700k-v1 --exclusive --network-disabled --output build/performance-baseline/reference-v1
npm run test:c-family-package
npm run test:release-rehearsal
npm run test:release-install-gate
npm run cli -- analyze --json
npm run build:builder-image
npm run test:canonical-build
npm run test:release-authorization
npm run release:reproducibility -- --output build/reproducibility-gate
npm run verify:independent-release -- --repository https://github.com/seanmorris/lean-bridge --published build/reproducibility-gate.tar
npm run cli -- --help
npm test
npm run test:reproducibility
npm run test:nix
nix --extra-experimental-features 'nix-command flakes' build .#php-native-package
nix --extra-experimental-features 'nix-command flakes' build .#universal-release-bundle
nix --extra-experimental-features 'nix-command flakes' build .#npm-package
nix --extra-experimental-features 'nix-command flakes' build .#release-rehearsal
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
- [Weaker](https://github.com/seanmorris/weaker)
- [PHP-Wasm](https://github.com/seanmorris/php-wasm)
- [PHP-Wasm extension loading](https://php-wasm.seanmorr.is/extensions/using-php-extensions.html)
- [Lean 4](https://github.com/leanprover/lean4)
- [Lean Language Reference](https://lean-lang.org/doc/reference/latest/)
- [Lean foreign-function interface](https://lean-lang.org/doc/reference/latest/Runtime-Code/Foreign-Function-Interface/)
- [Emscripten dynamic linking](https://emscripten.org/docs/compiling/Dynamic-Linking.html)
- [WebAssembly Component Model](https://github.com/WebAssembly/component-model)
