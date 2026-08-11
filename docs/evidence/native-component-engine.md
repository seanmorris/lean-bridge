# Native Nix component engine evidence

Observed on 2026-08-11 with Nix 2.8.0.

## Command

```sh
LEAN_BRIDGE_BUILD_BACKEND=nix node scripts/lean-bridge.mjs build \
  --project tests/fixtures/onboarding/small \
  --output /tmp/lean-bridge-native-nix-976.final \
  --target npm \
  --format json \
  --progress plain
```

The command completed with exit code 0. The CLI selected native Nix, prepared a closed component input, compiled the component once, and validated the emitted identities.

## Identities

| Object | SHA-256 |
| --- | --- |
| Engine | `0068f816a7a7b90c698347dc1d25add71807f6f87ba7b525b83a52c36ac8b40d` |
| Execution request | `8e8cc11f74ee42a604169a1dd2ea56ab1c88d7421e64731f37df80b651002930` |
| Input closure | `23dc31943b2b58fed179e876947b6122fb9887df7249471e62fe5a12ac7d7a9d` |
| Component plan | `5830af269e6ca435d2954a3af58708a0cb6d0d054c48eb85eaf47e21d91b715e` |
| Compilation plan | `7b48113ae9ac8f32fd481f8f6dd085ffbe548111a1f2ea91815d5e605fb0430b` |
| Bundle manifest | `15ff87bfdb8c6ffc4613a94597828c40f66a91085cd429eaa1a8c8cebef7d610` |
| Bundle identity | `3839bed53a7833a39816de80e4960c6378d94e54ecaf528f3257db7939685789` |

## Boundary checks

- The component was `onboarding-small@1.0.0`, an ordinary fixture outside the bridge source modules.
- The request and component closure were passed to the Nix app as separate paths.
- The component bundle contains one 1,440 byte side module. It contains no Lean runtime binary.
- The runtime requirement declares a shared, content-addressed peer with shared memory and table imports.
- The engine copied only the 19 files authorized by the execution request, plus the request and execution report retained by the CLI.
- The source closure remained read-only and retained the same identity after compilation.
- The installed component runtime build closure is 28 MB and contains the runtime archives, public headers, and audit records.
- The wrapper removed its writable Emscripten cache after execution.
