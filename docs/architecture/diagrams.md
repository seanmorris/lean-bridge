# Component and Lifecycle Diagrams

## Composition

```text
Lean library sources + theorem metadata
                 │
                 ▼
       binding/capsule generator
                 │
       ┌─────────┴───────────┐
       │ canonical manifest  │
       │ TS/schema/assurance │
       │ object/archive      │
       │ side-module .wasm   │
       └─────────┬───────────┘
                 │ one locked dependency graph
       ┌─────────┴─────────────┐
       ▼                       ▼
static final compositor   runtime descriptor loader
       │                       │
one app Wasm + runtime     one main runtime + N sides
       └─────────┬─────────────┘
                 ▼
       same generated TS contract
```

## Shared runtime

```text
Generated TypeScript namespaces
 alpha     beta      gamma
    \       |       /
     \      |      /
      shared JS registry + pending/error/callback domains
                         ↕
             narrow generated bridge ABI
                         ↕
       ┌──────────────────────────────────┐
       │ Emscripten main module           │
       │ one memory + table               │
       │ one Lean runtime / RC heap       │
       │ one Lean registry                │
       ├──────────────────────────────────┤
       │ Alpha side │ Beta side │ Gamma side
       └──────────────────────────────────┘
```

## Recursive library load

```text
createLeanApp([Gamma])
  → resolve canonical lock
  → Gamma requires Beta and Alpha
  → verify hashes/ABI/runtime/symbols
  → load Alpha side into main memory/table
  → initialize/register Alpha once
  → load Beta; initialize/register once
  → load Gamma; initialize/register once
  → merge generated namespaces/validators/trust graph
  → expose ready application factory
```

Duplicate request for the same build returns its registered namespace. A conflicting version, hash, schema, or symbol fails before user code.

## Complete call cycle

```text
JS/TS       JS registry       Gamma/Lean       Beta/Lean       host Promise
  │              │                 │                │                │
  │ validate + acquire leases      │                │                │
  ├─────────────►│                 │                │                │
  │ lower frame ├────────────────►│                │                │
  │              │                 ├───────────────►│                │
  │              │                 │  same Alpha.Model pointer       │
  │              │                 │◄───────────────┤                │
  │              │                 ├────────────────────────────────►│
  │ return pending; Wasm stack empty                │                │
  │              │                 │                │                │
  │              │ settlement re-enters            │◄───────────────┤
  │ callback ◄───┼─────────────────┤                │                │
  │ nested Beta call creates a new frame            │                │
  │ callback returns; nested frame unwinds           │                │
  │              │ canonicalize result wrapper      │                │
  │◄─────────────┴─────────────────┤                │                │
  │ dispose/result-scope cleanup in reverse order    │                │
  │ registries/pending/frame counters return baseline│                │
```

## Handle lifecycle

```text
unseen → interned/rooted → borrowed or leased → release queued
   → generation checked → root released → slot reusable at generation+1

shutdown: accepting → closing → pending settled/cancelled
   → owners released → epoch invalidated → closed
```

Finalizer fallback may enqueue `release`, but correctness relies on explicit disposal and generated scopes.

## Assurance chain

```text
Lean declaration ─ theorem/spec dependencies
       │                    │
       └──── source IDs ────┘
                │
        generated binding/schema
                │
       ABI + library descriptor
                │
        canonical Nix/graph lock
                │
  side/static artifact + TS wrapper hashes
                │
 proved / trusted-boundary / unverified graph
```
