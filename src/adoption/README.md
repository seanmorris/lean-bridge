# Adoption contracts

This directory records what a package consumer can install, execute, and measure.

## Responsibilities

- [`consumer-support.mjs`](consumer-support.mjs) validates the versioned downstream support matrix and assembles CI summaries.
- [`target-runtime-profiles.mjs`](target-runtime-profiles.mjs) validates closed runtime and platform profiles.
- [`onboarding.mjs`](onboarding.mjs), [`usability-gate.mjs`](usability-gate.mjs), and [`zero-config-audit.mjs`](zero-config-audit.mjs) evaluate author and consumer workflows.
- [`consumer-performance.mjs`](consumer-performance.mjs) and [`time-to-package.mjs`](time-to-package.mjs) normalize measured observations.

The machine-readable support claim lives in [`../../docs/consumer-support.v1.json`](../../docs/consumer-support.v1.json). Executed consumer evidence remains under the [evidence index](../../docs/evidence/README.md).
