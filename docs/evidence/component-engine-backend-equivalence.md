# Component engine backend equivalence

Observed on 2026-08-11 with the same `onboarding-small@1.0.0` component input and current 49-file engine identity.

## Comparison

```sh
node scripts/compare-component-engine-outputs.mjs \
  --native /tmp/lean-bridge-native-978.final \
  --docker /tmp/lean-bridge-docker-977.final
```

The comparator completed with exit code 0 and `status: passed`.

| Measurement | Result |
| --- | --- |
| Execution request | Byte-for-byte identical |
| Request SHA-256 | `d13fa226c8da222be8ad544e654edd420db3e395c06533b5a4c7cb9d9cae8095` |
| Engine SHA-256 | `02e658826385e04c6f8f003a60cf0088fd1c1f2097de38a3c1dbe015800e0fe1` |
| Authorized bundle files | 19 identical files |
| Authorized bundle bytes | 29,601 identical bytes |
| Bundle manifest SHA-256 | `15ff87bfdb8c6ffc4613a94597828c40f66a91085cd429eaa1a8c8cebef7d610` |
| Bundle identity SHA-256 | `3839bed53a7833a39816de80e4960c6378d94e54ecaf528f3257db7939685789` |
| Execution report difference | Backend label only |

The compared files include the 1,440 byte side module, Binding IR, private ABI, generated Lean adapter, component and compilation plans, compiler and linker manifests, artifact manifest, assurance and provenance metadata, runtime requirement, side-module audit, source closure, and bundle manifest.

The native report identifies `native-nix`. The Docker report identifies `docker-nix`. Removing that required field leaves identical reports. The comparator rejects any other report difference, request-byte difference, file-set difference, byte-length difference, or file-hash difference.
