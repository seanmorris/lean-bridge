# Architecture Design Package

Status: **architecture approved for the falsification-driven POC; production hardening remains unapproved**.

This directory contains the reviewed architecture for moving Lean components from proved source into ordinary application packages. Production work begins only after the POC establishes the shared-runtime model, lifecycle protocol, generated contract, and reproducible artifact identity.

## Package contents

- [Executive recommendation](executive-recommendation.md)
- [Vrzno and PHP-Wasm mapping](vrzno-lean-mapping.md)
- [Existing-work comparison](existing-work.md)
- [Recommended architecture](architecture.md)
- [Accessibility and universal composition contract](accessibility-composition.md)
- [Generated native binding contract](native-bindings.md)
- [Component and lifecycle diagrams](diagrams.md)
- [Architecture decisions](adr/README.md)
- [Proof-of-concept plan](poc-plan.md)
- [Risk register](risks.md)
- [Commit-pinned source dossier](sources.md)
- [Patch policy](patches.md)
- [Implementation approval checkpoint](approval.md)
- [Historical synthesis](../vision.md)
- [Native API performance evidence](../evidence/performance.md)

## Permanent review lenses

Every conclusion is reviewed for:

1. one shared Lean runtime with Unix-style side-module composition;
2. generated TypeScript and an ordinary npm experience;
3. explainable proof, trust, and artifact identity;
4. Nix-style reproducible graph composition;
5. a JavaScript-first but host-neutral core with a future WASI projection; and
6. preservation of metadata for AI-native verified component discovery and reuse;
7. accessible, ergonomic, zero-friction host-language adoption with optional progressive learning; and
8. universal, independently tested composition across semantics, ABI, runtime, proof/trust metadata, packages, locks, and target profiles.

An implementation that violates a lens requires an explicit compatibility profile and architecture decision.

## Requirement language

The key words `MUST`, `MUST NOT`, `REQUIRED`, `SHOULD`, `SHOULD NOT`, and `MAY` in architecture documents are interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119). Authors use these terms only for interoperability, safety, reproducibility, or another stated release requirement.
