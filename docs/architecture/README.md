# Architecture Design Package

Status: **readying for human architecture review; implementation not yet approved**.

This directory materializes the Virtual Office design package for the Vrzno-inspired Lean WebAssembly bridge. The governing decision is “yes, with constraints”: a useful bridge is feasible, but production work begins only after the shared-runtime side-module model, lifecycle protocol, generated contract, and reproducible artifact identity have been accepted.

## Package contents

- [Executive recommendation](executive-recommendation.md)
- [Vrzno and PHP-Wasm mapping](vrzno-lean-mapping.md)
- [Existing-work comparison](existing-work.md)
- [Recommended architecture](architecture.md)
- [Component and lifecycle diagrams](diagrams.md)
- [Architecture decisions](adr/README.md)
- [Proof-of-concept plan](poc-plan.md)
- [Risk register](risks.md)
- [Commit-pinned source dossier](sources.md)
- [Patch policy](patches.md)
- [Implementation approval checkpoint](approval.md)

## Permanent review lenses

Every conclusion is reviewed for:

1. one shared Lean runtime with Unix-style side-module composition;
2. generated TypeScript and an ordinary npm experience;
3. explainable proof, trust, and artifact identity;
4. Nix-style reproducible graph composition;
5. a JavaScript-first but host-neutral core with a future WASI projection; and
6. preservation of metadata for AI-native verified component discovery and reuse.

These are veto gates, not features scheduled for later cleanup.
