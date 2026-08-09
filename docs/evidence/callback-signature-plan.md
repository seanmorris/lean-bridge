# Callback Signature Plan Evidence

Status: Binding IR version 2, callback signature generation, JavaScript callback execution, and nested same-agent re-entry pass in browser, threaded, dynamic, and final-static profiles.

## Binding contract

Version 2 adds callback as a closed identity-bearing type. A callback definition records whether it may run once or many times, whether it may re-enter the shared runtime, how self-disposal behaves, its ordered parameters, ownership and lifetime at every site, result delivery, effects, and failure policy.

Record, resource, and alias definitions carry a null callable slot. A callback must be immutable, identity-bearing, and contain no record fields, alias target, or resource policy. The graph validator checks callback parameter and result types, ownership compatibility, lifetime anchors, failure references, effect consistency, and Promise delivery.

Version 1 documents cannot enter a generator directly. The registered migration validates the old graph, changes the schema version, adds null callable slots to existing type definitions, validates the version 2 result, and returns a new artifact with a new content hash.

## Generated plan

`compileCallbackSignatureV1` derives a signature ID from ABI-relevant callback semantics. Documentation and provenance do not change the signature ID. Parameter types, ownership, lifetimes, result delivery, effects, failure behavior, and referenced type layouts do change it.

The plan requires generation-safe host-function handles, canonical function identity inside one runtime, deterministic cleanup, fixed Wasm table adapters reused by signature ID, same-agent nested LIFO frames, a configurable depth budget, rejection before overflow, exception unwinding to the entry frame, and the declared self-disposal policy.

## Vrzno and WeakerMap architecture precedent

[Vrzno](https://github.com/seanmorris/vrzno) projects PHP callables as ordinary JavaScript functions. Its `callableToJs` path caches one wrapper for each native callable pointer, converts arguments through the shared runtime, invokes the PHP callback, and converts the result back to JavaScript. The public caller does not use `ccall` or know the calling convention. Vrzno also assigns canonical IDs to JavaScript objects and functions through forward and reverse identity maps. Its reference-count registry ties JavaScript reachability to PHP reference counts, and request shutdown invalidates the runtime-wide callable and object maps. [The Vrzno documentation](https://php-wasm.seanmorr.is/extensions/vrzno.html) demonstrates functions crossing in both directions through normal language call syntax.

Vrzno embeds a historical copy of `WeakerMap` for the reverse identity map from scalar native identities to weak JavaScript values. The maintained [Weaker repository](https://github.com/seanmorris/weaker) is the source precedent. Version 0.0.10 prevents an old finalizer from deleting a live value assigned to the same key, and replaces the finalization registry during `clear()` so callbacks from the retired registry cannot affect a reused map.

Lean Bridge carries those architecture choices into generated, typed bindings. One runtime owns callback identity in both directions. Generated packages expose native functions and keep private ABI calls internal. Generation-safe tokens reject stale handles after slot reuse. Explicit release performs normal cleanup, with finalization as a fallback. Stable signature IDs select fixed Wasm adapters, and the nested frame stack bounds same-agent re-entry and unwinds exceptions to the correct caller. The bridge weak-value cache also compares the finalized weak-reference identity with the current entry. This makes replacement safety explicit and lets tests reproduce stale finalizer delivery without relying on garbage collection timing.

## Executable checks

`tests/binding-ir-contract.test.mjs` validates callback shape, async effects, identity representation, and lifetime anchors. It also checks that version 1 input requires migration.

`tests/callback-signature.test.mjs` checks stable signature IDs, semantic drift, host-function transport, fixed adapter reuse, depth budgets, nested-frame policy, exception unwinding, and deep immutability.

`tests/callback-runtime.test.mjs` checks canonical generation-safe callback tokens, retained leases, signature mismatch rejection, once-only invocation, non-reentrant signatures, bounded nested LIFO frames, exception unwinding, and reject or defer self-disposal.

`tests/weak-value-map.test.mjs` checks canonical weak values, deterministic pruning, stale finalizers after replacement, stale registries after `clear()`, and primitive rejection. Native cleanup never runs from this map's finalizer. Runtime code queues native release work and drains it at a safe bridge entry.

`tests/lean-link-spike.test.mjs` exercises the generated `withCallback(value, transform)` binding. Lean increments the input, invokes a JavaScript function through a generated C closure, receives the result, increments it again, and returns it to JavaScript. The JavaScript callback constructs and reads a Lean `Box`, then recursively calls `withCallback` with the same function. The runtime records depths 1 and 2, reuses the canonical callback token, returns every lease and frame to zero, and leaves the public surface free of private calling conventions. A second test throws the original JavaScript error through the boundary and proves that the runtime remains usable afterward.

## Remaining boundary

Exported Lean closures still need the symmetric native JavaScript function projection. That path must use the weak-value reverse cache, deterministic `dispose()`, queued fallback release, and the same signature and frame rules. The current fixed adapter covers synchronous `UInt32 → UInt32`. Additional generated adapters must cover the remaining copied types, retained resources, Promise delivery, and declared error payloads.
