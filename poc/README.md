# Proof-of-concept fixtures

This directory contains executable fixtures used to falsify architecture claims.

| Directory | Purpose |
|---|---|
| [`lean-link-spike`](lean-link-spike/) | Real Lean runtime, independent component, package, and composition fixture. |
| [`link-spike`](link-spike/) | Small shared-runtime linker and loader fixture. |
| [`performance`](performance/) | Reference workloads, scaling graphs, and environment records. |
| [`php-native-runtime`](php-native-runtime/) | Native PHP runtime and extension fixture. |
| [`universal-package-fixture`](universal-package-fixture/README.md) | Canonical multi-ecosystem package input. |

Fixtures supply executable evidence. Reusable implementation belongs in [`../src`](../src/README.md), and durable results belong in the [evidence index](../docs/evidence/README.md).
