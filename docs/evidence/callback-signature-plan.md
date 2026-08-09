# Callback Signature Plan Evidence

Status: Binding IR version 2 and callback signature generation pass. Runtime callback execution and nested re-entry remain open.

## Binding contract

Version 2 adds callback as a closed identity-bearing type. A callback definition records whether it may run once or many times, whether it may re-enter the shared runtime, how self-disposal behaves, its ordered parameters, ownership and lifetime at every site, result delivery, effects, and failure policy.

Record, resource, and alias definitions carry a null callable slot. A callback must be immutable, identity-bearing, and contain no record fields, alias target, or resource policy. The graph validator checks callback parameter and result types, ownership compatibility, lifetime anchors, failure references, effect consistency, and Promise delivery.

Version 1 documents cannot enter a generator directly. The registered migration validates the old graph, changes the schema version, adds null callable slots to existing type definitions, validates the version 2 result, and returns a new artifact with a new content hash.

## Generated plan

`compileCallbackSignatureV1` derives a signature ID from ABI-relevant callback semantics. Documentation and provenance do not change the signature ID. Parameter types, ownership, lifetimes, result delivery, effects, failure behavior, and referenced type layouts do change it.

The plan requires generation-safe host-function handles, canonical function identity inside one runtime, deterministic cleanup, fixed Wasm table adapters reused by signature ID, same-agent nested LIFO frames, a configurable depth budget, rejection before overflow, exception unwinding to the entry frame, and the declared self-disposal policy.

## Vrzno architecture precedent

[Vrzno](https://github.com/seanmorris/vrzno) projects PHP callables as ordinary JavaScript functions. Its `callableToJs` path caches one wrapper for each native callable pointer, converts arguments through the shared runtime, invokes the PHP callback, and converts the result back to JavaScript. The public caller does not use `ccall` or know the calling convention. Vrzno also assigns canonical IDs to JavaScript objects and functions through forward and reverse identity maps. Its reference-count registry ties JavaScript reachability to PHP reference counts, and request shutdown invalidates the runtime-wide callable and object maps. [The Vrzno documentation](https://php-wasm.seanmorr.is/extensions/vrzno.html) demonstrates functions crossing in both directions through normal language call syntax.

Lean Bridge carries those architecture choices into generated, typed bindings. One runtime owns callback identity in both directions. Generated packages expose native functions and keep private ABI calls internal. Generation-safe tokens reject stale handles after slot reuse. Explicit release performs normal cleanup, with finalization as a fallback. Stable signature IDs select fixed Wasm adapters, and the nested frame stack bounds same-agent re-entry and unwinds exceptions to the correct caller.

## Executable checks

`tests/binding-ir-contract.test.mjs` validates callback shape, async effects, identity representation, and lifetime anchors. It also checks that version 1 input requires migration.

`tests/callback-signature.test.mjs` checks stable signature IDs, semantic drift, host-function transport, fixed adapter reuse, depth budgets, nested-frame policy, exception unwinding, and deep immutability.

## Remaining boundary

The JavaScript backend does not yet turn a callback parameter into a native function binding. The runtime still needs the shared callback registry, nested frame stack, disposal checks, exception projection, and a complete JavaScript to Lean to JavaScript re-entry test. Exported Lean closures need the symmetric native function projection and the same cleanup rules.
