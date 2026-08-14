# Architecture Design Package

Status: **architecture approved for the falsification-driven POC; production hardening remains unapproved**.

This directory contains the reviewed architecture for moving Lean components from proved source into ordinary application packages. Production work begins only after the POC establishes the shared-runtime model, lifecycle protocol, generated contract, and reproducible artifact identity.

## Package contents

- [Executive recommendation](executive-recommendation.md)
- [Vrzno and PHP-Wasm mapping](vrzno-lean-mapping.md)
- [PHP-Wasm, Vrzno, and Weaker extension audit](../evidence/php-wasm-vrzno-weaker-audit.md)
- [Existing-work comparison](existing-work.md)
- [Recommended architecture](architecture.md)
- [Accessibility and universal composition contract](accessibility-composition.md)
- [Generated native binding contract](native-bindings.md)
- [Canonical binding IR](binding-ir.md)
- [Component and lifecycle diagrams](diagrams.md)
- [Architecture decisions](adr/README.md)
- [Managed runtime target profiles](adr/23-managed-runtime-target-profiles.md)
- [Proof-of-concept plan](poc-plan.md)
- [Risk register](risks.md)
- [Commit-pinned source dossier](sources.md)
- [Patch policy](patches.md)
- [Implementation approval checkpoint](approval.md)
- [Production-hardening review, 14 August 2026](../evidence/production-hardening-review-20260814.md)
- [Historical synthesis](../vision.md)
- [Native API performance evidence](../evidence/performance.md)
- [Generated native call overhead](../evidence/native-call-overhead.md)
- [Lifecycle and memory stability evidence](../evidence/lifecycle-stability.md)
- [Performance reproducibility and self-consistency evidence](../evidence/performance-reproducibility.md)
- [Reproducible performance methodology](../evidence/performance-methodology.md)
- [Typed copied-value frame evidence](../evidence/typed-value-frame.md)
- [Generation-safe registry evidence](../evidence/generation-safe-registries.md)
- [Generated JavaScript backend evidence](../evidence/generated-javascript-backend.md)
- [Generated C backend evidence](../evidence/generated-c-backend.md)
- [Generated Rust backend evidence](../evidence/generated-rust-backend.md)
- [Generated Python backend evidence](../evidence/generated-python-backend.md)
- [Generated PHP backend evidence](../evidence/generated-php-backend.md)
- [Generated Zend adapter evidence](../evidence/generated-zend-adapter.md)
- [Shared native PHP runtime evidence](../evidence/shared-native-php-runtime.md)
- [Native PHP release package evidence](../evidence/native-php-release-package.md)
- [PHP-Wasm Lean side-module adapter evidence](../evidence/php-wasm-side-module-adapter.md)
- [PHP-Wasm release package evidence](../evidence/php-wasm-release-package.md)
- [PHP-Wasm shared runtime composition evidence](../evidence/php-wasm-shared-runtime-composition.md)
- [Native PHP and PHP-Wasm conformance evidence](../evidence/php-transport-parity.md)
- [PHP release gate evidence](../evidence/php-release-gate.md)
- [PHP transport performance evidence](../evidence/php-transport-performance.md)
- [Canonical package manifest evidence](../evidence/canonical-package-manifest.md)
- [Generated package drift gate evidence](../evidence/generated-package-gate.md)
- [Cross-language semantic parity evidence](../evidence/cross-language-semantic-parity.md)
- [Direct-call and native-object conformance evidence](../evidence/direct-call-conformance.md)
- [Shared PHP projection and transport boundary evidence](../evidence/php-projection-boundary.md)
- [Transactional multi-registry release evidence](../evidence/transactional-registry-release.md)
- [Plain project npm installation and receipt evidence](../evidence/plain-project-package-acceptance.md)
- [Zero-configuration and time-to-package evidence](../evidence/zero-configuration-acceptance.md)

## Permanent review lenses

Every conclusion is reviewed for:

1. one shared Lean runtime with Unix-style side-module composition;
2. generated TypeScript and an ordinary npm experience;
3. explainable proof, trust, and artifact identity;
4. Nix-style reproducible graph composition;
5. a JavaScript-first but host-neutral core with an executable WIT/WASI projection;
6. preservation of metadata for AI-native verified component discovery and reuse;
7. accessible, ergonomic, zero-friction host-language adoption with optional progressive learning; and
8. universal, independently tested composition across semantics, ABI, runtime, proof/trust metadata, packages, locks, and target profiles.

An implementation that violates a lens requires an explicit compatibility profile and architecture decision.

## Requirement language

The key words `MUST`, `MUST NOT`, `REQUIRED`, `SHOULD`, `SHOULD NOT`, and `MAY` in architecture documents are interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119). Authors use these terms only for interoperability, safety, reproducibility, or another stated release requirement.
