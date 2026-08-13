# ADR 23: Managed runtime target profiles

## Context

.NET, JVM, and Ruby can all call the existing generated C component boundary, but their ordinary package and lifecycle conventions differ. A separate semantic runtime for each language would duplicate Lean compilation, fragment shared-runtime composition, and make cross-language parity accidental.

## Decision

The first managed-runtime release profile targets x86-64 Linux with glibc 2.38 or newer. Every host package carries the exact canonical `liblean_bridge_native.so` and `liblean_alpha_component.so` artifacts. One process-wide Lean runtime serves every component. Registry packaging and installation do not compile Lean or native code.

The generated public APIs use host conventions:

- .NET 8 or newer uses static methods, immutable value types, sealed `IDisposable` resources, delegates, and named exceptions. Private interop uses source-generated `LibraryImport` calls and a native library resolver.
- JDK 22 or newer uses static methods, records, final `AutoCloseable` resources, functional interfaces, and named exceptions. Private interop uses the finalized Foreign Function and Memory API. JNI is not part of this profile.
- MRI Ruby 3.3 or newer uses module functions, immutable values, resource classes with `close`, blocks and callables, and named errors. Private interop uses the standard-library Fiddle API. Gem installation does not build a native extension.

Callbacks are synchronous and execute on the initiating runtime thread. Exceptions do not unwind through the C boundary. Generated adapters translate the status and error envelope into host exceptions. Explicit `Dispose` or `close` is authoritative, finalization is fallback only, and native libraries remain loaded until process exit.

The machine-readable contract is [target-runtime-profiles.v1.json](../../target-runtime-profiles.v1.json), validated by `src/adoption/target-runtime-profiles.mjs` and `tests/target-runtime-profiles.test.mjs`.

## Acceptance contract

A target is supported only after deterministic generation, host compilation, deterministic registry packaging, clean installation with scripts disabled, real Lean execution, semantic parity, deterministic lifecycle, shared-runtime composition, compile-once tracing, provenance verification, and installed API performance measurement all pass.

Async results, iterators, callbacks that escape their initiating call, and platforms outside the canonical Linux profile remain capability gaps until executable evidence exists.

## Consequences

The three language projections share semantics and native artifacts while retaining idiomatic public APIs. JDK 22 is required because it is the first release with the finalized Foreign Function and Memory API. Additional runtime versions or operating systems require new canonical native artifacts, clean-consumer evidence, and a versioned profile update.
