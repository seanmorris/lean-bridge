# Adoption contracts

This directory turns author and consumer observations into versioned, machine-checkable records. It answers whether a documented workflow installed the claimed artifact, executed real Lean, reported its environment, and remained consistent with the support matrix.

## Module map

| Module | Responsibility |
|---|---|
| [`consumer-support.mjs`](consumer-support.mjs) | Validates the downstream matrix, validates one CI result per consumer, detects support loss, and renders the GitHub summary. |
| [`type-surface.mjs`](type-surface.mjs) | Validates the required type baseline, hashes scoped evidence, and reports missing analysis, generation, compilation, packaging and installed-execution checks. Maintainer tooling only; not part of an installed consumer or CLI. |
| [`consumer-performance.mjs`](consumer-performance.mjs) | Defines the retained `Box` workload and normalizes per-consumer timing plus environment metadata. |
| [`target-runtime-profiles.mjs`](target-runtime-profiles.mjs) | Validates supported runtime, platform, transport, lifecycle, and capability-gap profiles. |
| [`onboarding.mjs`](onboarding.mjs) | Validates the onboarding fixture manifest and runs the Lean project matrix. |
| [`zero-config-audit.mjs`](zero-config-audit.mjs) | Evaluates whether analysis and package creation required annotations, prompts, wrappers, or source changes. |
| [`usability-gate.mjs`](usability-gate.mjs) | Validates clean-room session records and evaluates the documented workflow. |
| [`time-to-package.mjs`](time-to-package.mjs) | Records named workflow stages and compares observed package times with the versioned acceptance inputs. |

## Support evaluation

The support contract declares a state for each consumer. CI submits one result containing:

- the consumer identifier and declared state;
- package installation status;
- real Lean execution status;
- test result and command;
- performance observation and CPU identity; and
- an exact blocker when the target is not supported.

The evaluator rejects missing and duplicate consumers. A supported target fails evaluation if package installation, real Lean execution, or performance evidence is absent. The final report is built from downloaded job artifacts, so a package-generation smoke test cannot stand in for a clean consumer.

## Record ownership

| Record | Location |
|---|---|
| Downstream support states | [`../../docs/consumer-support.v1.json`](../../docs/consumer-support.v1.json) |
| Type/profile baseline and scoped audit | [`../../docs/type-surface.v1.json`](../../docs/type-surface.v1.json), validated by [`../../schema/type-surface.schema.json`](../../schema/type-surface.schema.json) |
| Runtime and platform profiles | [`../../docs/target-runtime-profiles.v1.json`](../../docs/target-runtime-profiles.v1.json) |
| Clean-room and zero-configuration inputs | [`../../acceptance`](../../acceptance/README.md) |
| Human-readable results | [Evidence index](../../docs/evidence/README.md) |

## Adding an adoption check

Run `npm run types:check` to validate the type inventory. `npm run types:report -- --profile rust --shape nat` prints every position and source path for one type, its evidence stages, and the VO owners of outstanding work. Neither command compiles Lean, executes recorded evidence commands, publishes packages, or changes the supported-consumer contract.

The type audit records ordinary npm scalar acceptance, inspected projections in every backend, constructor and delivery rejections, fixed Alpha templates, and the PHP-Wasm unsigned-integer defect. Unaudited positions remain visible. The [conversion-table generator](../../scripts/generate-type-docs.mjs) uses the same record for all consumer guides and the shared reference. It keeps Alpha's worked API separate and cannot promote inspection to installed execution. Remaining host-representation decisions and archive-bound type coverage stay assigned in VO1213/1214 and the type-family delivery tasks.

Observation selectors name exact profiles, positions and either ordinary source or reviewed IR. Their scopes must not overlap. Each stage identifies its evidence independently; inspected generator code cannot count as an installed execution. Accepted installed evidence records archive hashes. Source hashes are checked on every inventory read, so changing an audited implementation requires an updated review. Historical archive hashes identify the recorded acceptance; they are not a fresh verification or publication of those archives.

All listed runtime shapes remain required delivery work unless a recorded review decision and follow-up justify a profile exclusion. Proof-only shapes require correct erasure. Unreviewed cells are not assertions of missing implementation, and rejected cells do not complete the plan. The baseline includes nested options, result argument order, host null versus omitted arguments, platform integer width and runtime refinement checks.

Add a schema or validator for the new record, one accepted fixture, rejection tests for unsupported claims, and a command that produces the record from a clean workflow. Documentation may claim support only after the consumer matrix executes the installed package.

Tests include [`../../tests/onboarding-acceptance.test.mjs`](../../tests/onboarding-acceptance.test.mjs), [`../../tests/usability-gate.test.mjs`](../../tests/usability-gate.test.mjs), [`../../tests/time-to-package.test.mjs`](../../tests/time-to-package.test.mjs), and [`../../tests/documentation.test.mjs`](../../tests/documentation.test.mjs).
