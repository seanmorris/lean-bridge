# Plain component compiler adapters

## Result

The installed engine can derive deterministic compiler adapters from a plain project without changing its source.

For `OnboardingSmall.add`, the generator emits a private symbol and a generated Lean definition:

```lean
@[export lean_bridge_baf750c03528366aea19023e]
def export_a766bef2a37185a6b245 (left : Nat) (right : Nat) : Nat :=
  OnboardingSmall.add left right
```

The hashes above are derived from component and declaration identities. They are private ABI names. JavaScript, Python, and other consumers continue to see `add` through generated native bindings.

The author-owned [`OnboardingSmall.lean`](../../tests/fixtures/onboarding/small/OnboardingSmall.lean) file contains no export or publishing annotations. The generated annotation lives in `LeanBridgeGenerated.lean` inside build staging.

## Generated closure

[`src/build/compiler-adapters.mjs`](../../src/build/compiler-adapters.mjs) emits three files:

- `LeanBridgeGenerated.lean` imports the exact source modules and defines deterministic exported wrappers.
- `compiler-adapters.json` binds every wrapper and symbol to the component plan hash.
- `private-abi.json` gives the runtime generator direct symbols, parameter types, result types, and delivery modes.

The private ABI declares `direct-symbols`. The validator rejects generic dispatch. Adapter output is atomic, refuses an existing destination, and stays identical when the same project moves to another checkout root.

`IO` and `Task` results retain their Lean effect in generated wrappers and use Promise delivery in the private ABI. `EIO` remains blocked until its typed error mapping is supplied.

## Remaining compiler work

The generator does not yet invoke Lean or Emscripten. The next gate must compile `LeanBridgeGenerated.lean` with the read-only component source, verify every planned symbol in one runtime-free side module, and bind the Wasm hash back to the component plan.
