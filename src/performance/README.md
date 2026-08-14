# Performance evidence modules

This directory measures the behavior that consumers experience when generated APIs load and call Lean components. It defines workloads, records the execution environment, runs repeated observations, and packages results with enough identity information to reproduce or compare them.

## Measurement layers

```text
versioned corpus + workloads + methodology
                    |
                    v
            fixture preparation
                    |
                    v
     overhead, lifecycle, and scaling runs
                    |
                    v
       environment-tagged result records
                    |
                    v
          CI report and evidence bundle
```

The measurements focus on end-user behavior: generated call overhead, workload latency, runtime startup and sharing, lifecycle stability, and scaling as more components participate. Build timing can appear as provenance for an evidence run, but it is not presented as a product performance claim.

## Module map

| Modules | Responsibility |
|---|---|
| [`corpus.mjs`](corpus.mjs), [`workloads.mjs`](workloads.mjs), [`methodology.mjs`](methodology.mjs) | Validate the source corpus, workload definitions, warmup and sampling rules, statistics, and environment requirements. |
| [`harness.mjs`](harness.mjs) | Execute samples, retain raw observations, and calculate the specified summaries. |
| [`overhead-fixture.mjs`](overhead-fixture.mjs), [`overhead.mjs`](overhead.mjs) | Prepare and measure direct generated calls against the comparison paths defined by the workload. |
| [`lifecycle-fixture.mjs`](lifecycle-fixture.mjs), [`lifecycle.mjs`](lifecycle.mjs) | Exercise initialization, shared and isolated runtimes, repeated calls, cleanup, and memory observations. |
| [`scaling.mjs`](scaling.mjs) | Measure graph and runtime behavior as the component count or workload size changes. |
| [`reproducibility.mjs`](reproducibility.mjs) | Compare build inventories and check that an evidence set refers to the expected artifacts. |
| [`ci-report.mjs`](ci-report.mjs), [`evidence-bundle.mjs`](evidence-bundle.mjs) | Assemble per-consumer observations, limitations, artifact identities, and index records. |

Baseline comparison logic also lives here. It reports changed observations with their environment and sample context. It does not turn results from different machines into an unsupported regression claim.

## Observation identity

A result is meaningful only with its workload version, component and package hashes, runtime profile, host architecture, operating system, runtime versions, warmup policy, sample count, and statistic. The report formats retain these fields so a hosted runner result cannot silently replace a reference-machine result.

Reference measurements and GitHub-hosted observations remain separate series. Comparisons require compatible workload and environment identities. When those identities differ, the report preserves both records and states the limitation.

## Adding a workload

1. Add the smallest fixture that exercises the consumer-visible behavior.
2. Register the workload and methodology in the versioned fixture records under [`../../poc/performance`](../../poc/performance/).
3. Record warmup, sample, statistic, runtime, and environment requirements.
4. Extend the appropriate overhead, lifecycle, or scaling runner.
5. Preserve raw observations alongside calculated summaries.
6. Add schema, validator, report, and reproducibility tests.
7. Link the reviewed result from the evidence index before quoting it in the project README.

Do not compare numbers that use different operations under the same label. For example, a browser measurement that includes message transport must identify that transport rather than appear as a direct-call measurement.

## Verification and evidence

Performance tests under [`../../tests`](../../tests/README.md) cover corpus and methodology validation, harness statistics, direct-call overhead, lifecycle behavior, scaling, report construction, and evidence reproducibility. The [performance methodology](../../docs/evidence/performance-methodology.md) defines the executed protocol. The [performance evidence](../../docs/evidence/performance.md) and [library scaling evidence](../../docs/evidence/library-scaling.md) publish reviewed results with environment and limitation records.
