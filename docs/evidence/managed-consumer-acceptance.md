# Managed consumer acceptance, 13 August 2026

Status: clean NuGet, Maven, and RubyGems consumers install deterministic packages and execute real Alpha and Beta Lean components through one native runtime.

## Artifact construction

The canonical release bundle contains one native runtime library, independently compiled Alpha and Beta component libraries, generated C# and Java compiler outputs, generated Ruby sources and RBS, Binding IR identity, provenance, and package receipts. Registry projection has compiler access disabled. NuGet, Maven, and RubyGems only select, arrange, copy, render metadata, and archive reviewed canonical artifacts.

The pinned Nix projections produced these archives:

| Package | Coordinate | SHA-256 |
|---|---|---|
| NuGet | `LeanBridge.Alpha@0.0.0` | `4fca80896b387f7839fa332c38342b60d06d2c775524b0b919072c9ab98438c8` |
| Maven | `org.leanbridge:lean-alpha:0.0.0` | `1ab587be375f4c8866f47d818390922674a1cd3b9fbf93234deae7cd287ba1ba` |
| RubyGems | `lean_bridge_alpha@0.0.0` | `644accb65f017985a2296fb3095ed8063d4efe6a5091ca82b3f382c1571de328` |

These hashes identify the pinned Nix acceptance build. The deterministic package test separately builds each projection in two independent roots and requires byte equality. The release workflow derives hashes again from the exact committed inputs and records them in the publication rehearsal.

## Clean consumer execution

[`scripts/test-managed-registry-consumers.mjs`](../../scripts/test-managed-registry-consumers.mjs) performs ordinary package-manager operations:

- `dotnet restore` selects the local NuGet source and copies its runtime-specific native assets;
- Maven resolves `org.leanbridge:lean-alpha:0.0.0` from the generated repository;
- RubyGems installs the local gem under MRI Ruby 3.3 without building an extension.

Every consumer then executes a real Lean `Box`, a copied `Payload`, a host callback invoked by Lean, and a callable returned by Lean. A private conformance probe passes the live Alpha `Box` to the separately compiled Beta component. The broker snapshot must show one runtime initialization, two component initializations, and two attached components. Each fixture closes owned values twice, rejects stale use, requires zero live identities after cleanup, and checks the same 7,300,000 checksum over 100,000 retained `Box` reads.

The JVM fixture also executes the public API from Kotlin and two isolated class loaders. Callback assertions require the initiating thread in all three hosts. The Ruby fixture compacts the GC while its `Box` remains live. These probes do not add transport controls to the public package API.

## End-user performance

The observed run used Linux x86-64 on an Intel Core i7-7700K at 4.20 GHz. Each process warmed the installed generated API with 10,000 calls, then measured 100,000 calls.

| Consumer | Total duration | Result |
|---|---:|---:|
| .NET 8 | 2,029,860 ns | 20.3 ns/call |
| JDK 22 | 53,707,790 ns | 537.1 ns/call |
| MRI Ruby 3.3 | 426,172,167 ns | 4.26 µs/call |

These are observational end-user API measurements from one machine. They do not provide a confidence interval or predict other processors.

The same installed-package run also measures the first `Box` creation and read, 10,000 copied-value calls, 10,000 callbacks, 10,000 returned-callable invocations, peak process RSS, and archive size.

| Consumer | First `Box` and read | Copied `Payload` | Callback | Lean callable | Peak RSS | Archive |
|---|---:|---:|---:|---:|---:|---:|
| .NET 8 | 7.74 ms | 1.82 µs/call | 246.5 ns/call | 27.8 ns/call | 44.7 MiB | 4,343,881 bytes |
| JDK 22 | 310.17 ms | 17.49 µs/call | 32.08 µs/call | 1.37 µs/call | 220.9 MiB | 4,355,548 bytes |
| MRI Ruby 3.3 | 108.7 µs | 23.20 µs/call | 14.78 µs/call | 4.56 µs/call | 32.8 MiB | 4,220,928 bytes |

Async results and iterators remain declared capability gaps, so no timing is reported for them. The existing [library scaling record](library-scaling.md) supplies the 1, 3, 10, and 50-component shared-runtime memory comparison. The managed fixture adds the executable two-component native composition case rather than simulating additional native components.

## Executable evidence

- [`tests/managed-generators.test.mjs`](../../tests/managed-generators.test.mjs) checks deterministic sources and public API constraints.
- [`tests/managed-artifacts.test.mjs`](../../tests/managed-artifacts.test.mjs) checks byte-identical .NET and JVM compiler outputs.
- [`tests/managed-registry-package.test.mjs`](../../tests/managed-registry-package.test.mjs) checks fail-closed eligibility, deterministic archives, and unchanged native hashes.
- [`scripts/test-managed-native-bindings.mjs`](../../scripts/test-managed-native-bindings.mjs) runs the generated transports directly.
- [`scripts/test-managed-registry-consumers.mjs`](../../scripts/test-managed-registry-consumers.mjs) proves ordinary package installation and real Lean execution.
