# Performance evidence modules

This directory defines reproducible workloads, measurement harnesses, lifecycle probes, scaling runs, and report formats.

## Structure

- [`methodology.mjs`](methodology.mjs), [`workloads.mjs`](workloads.mjs), and [`corpus.mjs`](corpus.mjs) validate measurement inputs.
- [`harness.mjs`](harness.mjs), [`overhead.mjs`](overhead.mjs), [`lifecycle.mjs`](lifecycle.mjs), and [`scaling.mjs`](scaling.mjs) execute the measured profiles.
- [`reproducibility.mjs`](reproducibility.mjs), [`ci-report.mjs`](ci-report.mjs), and [`evidence-bundle.mjs`](evidence-bundle.mjs) compare and package results.

Hosted-runner results retain their environment identity. Reference results remain separate from CI observations so hardware differences stay visible.

See the [performance methodology](../../docs/evidence/performance-methodology.md), [performance evidence](../../docs/evidence/performance.md), and [library scaling evidence](../../docs/evidence/library-scaling.md).
