# Canonical Binding IR

Status: implemented contract for the architecture POC.

The binding intermediate representation records one component's public semantics before a generator chooses JavaScript, TypeScript, C, Rust, Python, or another host syntax. Every backend receives the same type, ownership, failure, capability, and assurance data. A backend can adapt those semantics to native language conventions. It cannot redefine them.

The version 2 artifacts are:

- [`schema/binding-ir.schema.json`](../../schema/binding-ir.schema.json), the closed interchange schema;
- [`src/binding-ir/contract.mjs`](../../src/binding-ir/contract.mjs), the graph and semantic validator;
- [`src/binding-ir/frontend.mjs`](../../src/binding-ir/frontend.mjs), the versioned producer adapter boundary; and
- [`poc/lean-link-spike/bindings/alpha.binding-ir.json`](../../poc/lean-link-spike/bindings/alpha.binding-ir.json), the reviewed golden fixture.

The JavaScript, Python, C, and Rust generators consume this fixture. The Python generator emits a normal package, typed value and resource classes, stubs, a private transport protocol, documentation, and a hash-bound manifest. The C generator emits a public C11 header, implementation, internal per-declaration runtime interface, documentation, and a hash-bound manifest. The Rust generator emits a safe crate, a hidden typed runtime trait, documentation, capability-gap metadata, and a hash-bound manifest. Their executed consumer fixtures demonstrate that target syntax and lifecycle conventions can change without creating another semantic contract.

## What the IR records

| Concern | Version 2 representation | Required backend behavior |
|---|---|---|
| Primitive values | Unit, booleans, fixed-width integers, arbitrary integers, floats, strings, and bytes | Preserve the semantic type. Do not substitute an untyped JSON protocol. |
| Constructed values | Arrays, options, results, tuples, named types, and generic parameters | Reject unsupported instantiations before generating a package. |
| Value identity | Every named type declares `copied` or `identity` representation | Generate native values for copied types and canonical resources or classes for identity types. |
| Declarations | Functions, constructors, methods, static methods, properties, overload keys, parameters, defaults, and results | Emit direct named callables. Keep symbol dispatch and ABI calls private. |
| Mutation and effects | Immutable, read, and write access plus allocation, resource access, host calls, failure, async work, and nondeterminism | Preserve observable behavior and reject target profiles that cannot support required effects. |
| Ownership | Copy, borrow, lease, and transfer | Generate validation, retain and release operations, disposal, and wrapper reuse from the declared transition. |
| Lifetime | Call, receiver, parameter, explicit, or runtime scope with a checked anchor where required | Prevent a generated borrow from outliving its anchor. |
| Resource policy | Nominal kind, disposal policy, finalizer fallback, and cycle policy | Use generation-safe tokens and deterministic cleanup. Finalization remains a fallback. |
| Callbacks and closures | Identity-bearing callback types with invocation count, re-entry, self-disposal, parameters, result delivery, effects, and failure semantics | Generate stable signature IDs, native callables, handle conversion, fixed Wasm table adapters, nested frame checks, and deterministic cleanup. |
| Failure | No declared failure or a closed set of declared errors, plus trap or poisoned-runtime handling for unexpected failures | Project the same failures through idiomatic exceptions or result types without dropping cases. |
| Result delivery | Value, Promise, iterator, or async iterator | Generate the target's native protocol when its capability profile supports it. |
| Capabilities | Required or optional host, target, runtime, and feature capabilities | Fail generation for a missing required capability. Report an optional gap explicitly. |
| Assurance | Proved, trusted-boundary, or unverified claims with theorem names, assumptions, subject identity, and source | Keep assurance data attached to generated documentation and artifact metadata. |

## Ownership invariants

A copied value has no cross-boundary lifetime. The receiver can retain its own copy without registering a handle.

An identity value uses an opaque runtime token internally. Host code receives a canonical object, class, resource, or equivalent native projection. The token, runtime identity, generation, and nominal kind remain private.

A borrow does not create ownership. Its lifetime ends with the call or remains anchored to a named receiver or parameter. A lease retains a resource until explicit disposal or runtime shutdown. A transfer moves ownership through the call boundary. Backend tests must exercise the same transitions even when their surface syntax differs.

Copied records cannot contain identity-bearing fields. Identity values cannot declare copy ownership. Non-copy ownership requires a lifetime. The semantic validator rejects each violation before generation.

## Rich values cross as rich values

The Alpha fixture declares this copied record:

```json
{
  "id": "lean:Alpha.Payload",
  "kind": "record",
  "representation": "copied",
  "fields": [
    { "name": "enabled", "type": { "kind": "primitive", "name": "bool" } },
    { "name": "count", "type": { "kind": "primitive", "name": "uint32" } },
    { "name": "label", "type": { "kind": "primitive", "name": "string" } },
    { "name": "bytes", "type": { "kind": "primitive", "name": "bytes" } },
    {
      "name": "values",
      "type": {
        "kind": "apply",
        "constructor": "array",
        "arguments": [{ "kind": "primitive", "name": "uint32" }]
      }
    }
  ]
}
```

The shortened example omits required documentation and mutability fields. The complete fixture is the executable contract. A JavaScript backend can project `bytes` as `Uint8Array` and `values` as an array or typed array after recording that target choice. A C backend can project fixed-width fields and explicit spans. Both projections originate from the same record definition and must round-trip the same values.

## Language-neutral core and producer metadata

The core contains concepts that every backend must understand:

- declarations and semantic types;
- value identity and mutation;
- ownership and lifetime transitions;
- failures, effects, and result delivery;
- capability requirements;
- documentation and assurance links.

The separation is explicit:

| Classification | Examples | Location |
|---|---|---|
| Universal semantics | Functions, records, resources, generics, ownership, lifetimes, failures, effects, and assurance states | Closed core fields |
| Target requirements | Browser host calls, runtime features, threads, async delivery, and optional target features | Capability records checked by each backend |
| Producer facts | Lean module names, elaborator output identity, export selection, source declarations, and proof-system provenance | Declared producer records and namespaced extensions |

Producer adapters supply this core. The first adapter reads Lean declarations, elaborated types, export selection, and proof provenance. Lean-specific facts remain under namespaced keys such as `lean-lang.org/module` and `lean-lang.org/export`. Bridge-generated facts use a separate namespace such as `lean-wasm.org/evidence`.

The validator rejects unnamespaced extension keys and references to undeclared producers. Another proof system or schema compiler can add an adapter without adding its declaration syntax to the core. It must still express ownership and proof meaning precisely. Language neutrality does not permit an adapter to erase those facts.

`createBindingIrFrontend` binds a producer ID, adapter name, and adapter version to an analysis function. It validates the returned graph, verifies the producer declaration, clones the result, and freezes it before a backend sees it. Contract tests exercise this boundary with a schema-produced arithmetic component that contains no Lean declaration or Lean metadata.

## Validation boundary

The JSON Schema rejects malformed and unknown fields. The JavaScript contract validator checks rules that require the complete graph, including unique identities, producer references, named type resolution, generic parameter scope, copied record closure, ownership compatibility, lifetime anchors, error references, capability references, assurance subjects, and async effects.

All generators MUST validate the IR before emitting files. A generator MUST reject an unknown schema version. Target-specific choices belong in backend capability analysis or namespaced metadata, never in an unreviewed core field.

## Canonical bytes and content identity

`canonicalizeBindingIr` emits compact UTF-8 JSON with these rules:

- object names are sorted by UTF-16 code unit;
- array order is preserved because declaration, parameter, field, and theorem order can carry meaning;
- numbers use ECMAScript JSON serialization and must be finite;
- strings and object names must contain valid Unicode scalar values;
- reference cycles, sparse arrays, non-JSON values, and non-plain objects are rejected; and
- the canonical byte sequence has no trailing newline.

These rules follow the JSON Canonicalization Scheme ordering and primitive serialization model. `hashBindingIr` computes SHA-256 over the canonical UTF-8 bytes. The reviewed Alpha fixture has this semantic identity:

```text
e3a9f0e95e65a76f8d4776ced695ae5a6fffd83028b2307fa2345c7a28a545a4
```

Changing object insertion order preserves the hash. Changing documentation, assurance, types, ownership, or any other recorded field changes the hash. Packages and provenance reports can therefore identify the exact reviewed semantic contract consumed by every backend.

## Compatibility rules

`schemaVersion` is a semantic major version. Version 2 consumers accept version 2 artifacts and reject every other version before generation. Unknown core fields also fail validation. Namespaced extension objects can add producer facts without changing the core schema, but a backend cannot depend on an extension to replace required core semantics.

The version diagnostic reports one of these outcomes:

| Outcome | Required action |
|---|---|
| Exact version | Validate the full graph, then generate. |
| Older version | Run a registered migration and review the new hash. |
| Newer version | Upgrade the consumer before generation. |
| Invalid version | Regenerate with a conforming frontend. |

The version 1 to version 2 migration adds a null callable slot to existing record, resource, and alias definitions. Version 2 producers can add callback definitions. Migration returns a new validated artifact with a new content identity. It does not edit the version 1 artifact.

## CLI contract

CI and agents can inspect the IR without loading a host backend:

```sh
npm run binding-ir -- validate poc/lean-link-spike/bindings/alpha.binding-ir.json
npm run binding-ir -- hash poc/lean-link-spike/bindings/alpha.binding-ir.json
npm run binding-ir -- diagnose poc/lean-link-spike/bindings/alpha.binding-ir.json
npm run binding-ir -- canonicalize poc/lean-link-spike/bindings/alpha.binding-ir.json
```

Diagnostics use stable error codes and structured details. The `diagnose` command emits JSON for automated migration and upgrade decisions.
