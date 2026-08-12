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

## Runtime performance

Direct warm scalar calls through the generated APIs complete in hundreds of nanoseconds on the reference machine. Callback and PHP-Wasm warm calls remain in the low single-digit microseconds. Sharing one runtime across 50 Lean libraries cuts Wasm linear-memory allocation from 851,968,000 bytes to 17,039,360 bytes, a 50-fold reduction.

These August 2026 measurements used Linux x86-64, Node 22.23.1, an Intel Core i7-7700K, eight logical CPUs, and 25 GB of memory.

| Measurement | Result | Limitation | Evidence |
|---|---:|---|---|
| Generated retained Lean method, median | 302 ns | Warm Node process and one Alpha fixture | [native call overhead](docs/evidence/native-call-overhead.md) |
| Generated JavaScript callback invoked by Lean, median | 1.694 µs | Warm Node process | [native call overhead](docs/evidence/native-call-overhead.md) |
| Native PHP retained read, median | 179.5 ns | Warm PHP process on the supported native target | [PHP transport performance](docs/evidence/php-transport-performance.md) |
| PHP-Wasm retained read, median | 1.580 µs | Warm startup profile in the Node-hosted PHP-Wasm runtime | [PHP transport performance](docs/evidence/php-transport-performance.md) |
| 50 libraries with one shared runtime | 17,039,360 bytes | Wasm linear memory only | [library scaling](docs/evidence/library-scaling.md) |
| 50 libraries with isolated runtimes | 851,968,000 bytes | Comparison profile, not a supported package layout | [library scaling](docs/evidence/library-scaling.md) |

## Documentation

- [Lean package author guide](docs/lean-author-guide.md)
- [JavaScript and TypeScript consumer guide](docs/javascript-typescript.md)
- [PHP consumer guide](docs/php.md)
- [Python, Rust, C, C++, browser, and WIT/WASI status](docs/consumers.md)
- [Implementation status and inventory](docs/status.md)
- [Architecture index](docs/architecture/README.md)
- [Evidence index](docs/evidence/README.md)
- [Contributing](CONTRIBUTING.md)

This repository is an architecture-testing proof of concept. It publishes no live registry package and includes no live registry adapter.
