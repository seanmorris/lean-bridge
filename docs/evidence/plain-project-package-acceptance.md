# Plain project package acceptance

Observed on 2026-08-11 with a copy of `tests/fixtures/onboarding/small` placed in a temporary directory outside the repository.

## Result

The acceptance runner analyzed the plain Lean project without annotations or prompts. It built the component twice with the Nix component engine, projected two npm package sets, and compared 42 files. Every byte and file mode matched. The runner performed no registry writes.

The component package contains one 1,440 byte side module and no runtime binary. The `@lean-bridge/runtime` package contains one runtime Wasm binary. npm installed both archives with install scripts disabled.

The consumer imported `add` and `isEmpty` from `onboarding-small`. The live calls returned:

```json
{
  "add": "123",
  "empty": true,
  "nonempty": false
}
```

The component package root exposes generated functions. It contains no `ccall`, `cwrap`, private Lean symbol, or `WebAssembly` API. Symbol lookup, dynamic loading, Nat and string adaptation, runtime initialization, and reference handling remain inside the shared runtime dependency.

## Identities

| Evidence | SHA-256 |
| --- | --- |
| Engine | `6282cbdca9cd9739edbd20ea1897e8c37d6ef1d6c4bb342bfd17a8b7f6a8095c` |
| Execution request | `9282097f70fb5b8885a1dcb92eb450b0ee40ffa0c3df40359d44db7c03422bb0` |
| Component plan | `5830af269e6ca435d2954a3af58708a0cb6d0d054c48eb85eaf47e21d91b715e` |
| Compilation plan | `7b48113ae9ac8f32fd481f8f6dd085ffbe548111a1f2ea91815d5e605fb0430b` |
| Component bundle manifest | `15ff87bfdb8c6ffc4613a94597828c40f66a91085cd429eaa1a8c8cebef7d610` |
| Component bundle identity | `3839bed53a7833a39816de80e4960c6378d94e54ecaf528f3257db7939685789` |
| Reproducible inventory | `ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356` |
| Package receipt | `01973d37052f821d7694c2c6356b6083e487b103c496174d6c9c7064533eee9f` |

The receipt names `onboarding-small@1.0.0`, its source tree, Binding IR, provenance, component artifact, shared runtime requirement, npm archives, and component identity. The verifier recomputed both archive hashes and accepted the receipt. The retained identity audit found no `Alpha` fixture identity.

## Reproduction

Build the shared runtime first, then run:

```sh
npm run acceptance:plain-project-package -- \
  --fixture tests/fixtures/onboarding/small \
  --output build/plain-project-package-acceptance \
  --backend nix

node scripts/verify-component-package-receipt.mjs \
  --receipt build/plain-project-package-acceptance/component-package-receipt.json
```

The machine-readable result is [`plain-project-package-acceptance.json`](plain-project-package-acceptance.json).
