# Docker component engine evidence

Observed on 2026-08-11 with Docker 24.0.9 and Nix 2.24.11 in the pinned Debian builder.

## Command

```sh
LEAN_BRIDGE_BUILD_BACKEND=docker node scripts/lean-bridge.mjs build \
  --project tests/fixtures/onboarding/small \
  --output /tmp/lean-bridge-docker-977.final \
  --target npm \
  --format json \
  --progress plain
```

The command completed with exit code 0. Docker ran the reviewed builder image `lean-bridge-builder:c557918fec8ab3ca`, whose config digest is `93c7df682303a033e37acf2099b7bbdae0fd9d76103b993115f271469cd46325`.

## Identities

| Object | SHA-256 |
| --- | --- |
| Engine | `02e658826385e04c6f8f003a60cf0088fd1c1f2097de38a3c1dbe015800e0fe1` |
| Execution request | `d13fa226c8da222be8ad544e654edd420db3e395c06533b5a4c7cb9d9cae8095` |
| Input closure | `23dc31943b2b58fed179e876947b6122fb9887df7249471e62fe5a12ac7d7a9d` |
| Component plan | `5830af269e6ca435d2954a3af58708a0cb6d0d054c48eb85eaf47e21d91b715e` |
| Compilation plan | `7b48113ae9ac8f32fd481f8f6dd085ffbe548111a1f2ea91815d5e605fb0430b` |
| Bundle manifest | `15ff87bfdb8c6ffc4613a94597828c40f66a91085cd429eaa1a8c8cebef7d610` |
| Bundle identity | `3839bed53a7833a39816de80e4960c6378d94e54ecaf528f3257db7939685789` |

## Boundary checks

- Docker received separate read-only mounts for the engine, component closure, and execution request.
- Docker received one read-write output mount and emitted only the authorized bundle, execution request, and execution report.
- The engine program and its 5.5 GB transitive Nix closure were mounted read-only. The builder image is 685 MB.
- The engine source boundary contains the entrypoint's complete static module graph. Tests, documentation, package projections, and ignored toolchains are absent.
- The component bundle is 124 KB and contains one 1,440 byte side module. It contains no Lean runtime binary.
- The runtime requirement identifies one shared, content-addressed runtime peer with shared memory and table imports.
- The source closure retained its pre-build identity after execution.
- The Docker result has the same component plan, compilation plan, input closure, bundle manifest, and bundle identity as the prior native Nix result.
