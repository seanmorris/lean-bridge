# Complete performance evidence in GitHub Actions

Status: implemented. The `Complete performance evidence` workflow runs the full shared-runtime performance suite on every push and on manual dispatch. This initial cadence collects enough cost data to decide which measurements belong on pull requests and which belong on a schedule.

## What the workflow reports

The workflow builds one locked benchmark graph, then measures it in isolated jobs. The GitHub job summary includes:

- startup, library loading, construction, first-call, and memory results for lazy, startup, final-static, and isolated-runtime composition;
- 1, 3, 10, and 50-library graphs, including artifact counts, exact bytes, phase timings, runtime counts, and memory;
- scalar, retained-object, copied-record, callback, nested callback, iterator, Promise, cancellation, and exception overhead through generated public bindings;
- lifecycle high-water marks, retained state, delayed finalization, cross-runtime rejection, and shutdown behavior;
- semantic parity across composition profiles;
- timing variance from three repetitions; and
- artifact equality from two clean builds.

Every timing value names its unit and sample count. Every measured artifact retains its byte count and SHA-256. The report also records each CI job's elapsed time, runner disk before and after execution, workspace size, toolchain size, build size, evidence size, and toolchain-cache state.

## Failure policy

Shared GitHub runners cannot establish a baseline. Their processors, kernels, neighboring workloads, and power states may differ between jobs. Timing and memory changes therefore remain informational until an approved versioned budget authorizes a specific regression failure.

Evidence integrity is mandatory. CI fails when a required result is missing, a profile or library count is absent, correctness fails, semantic results drift, clean builds differ, source revisions disagree, schemas are unsupported, or reported artifact hashes do not match the build manifest.

The final report job uses `always()` so it can summarize partial evidence after another job fails. It labels missing data as unavailable, uploads the surviving records, and then preserves the failed workflow state.

## Machine-readable evidence

The final workflow artifact is named `performance-evidence-<commit>-<attempt>` and is retained for 30 days. Its deterministic archive contains:

- the versioned aggregate report;
- every raw child benchmark record;
- the validation report;
- the rendered Markdown summary;
- the workload, corpus, and methodology manifests;
- build identities, source revision, toolchain pins, and artifact hashes; and
- commands and resource snapshots for each job.

The aggregate contract is `schema/performance-ci-report.schema.json`. Child records keep their existing versioned schemas. The aggregator consumes JSON records directly and never scrapes console text.

## Local checks

Run the reporter contract tests with:

```sh
npm run test:performance-ci
```

The individual measurements remain available through the existing commands:

```sh
npm run benchmark:spatial -- --output build/performance-ci/input/spatial.json
npm run benchmark:scaling -- --output build/performance-ci/input/scaling.json
npm run benchmark:overhead -- --output build/performance-ci/input/overhead.json
npm run benchmark:lifecycle -- --output build/performance-ci/input/lifecycle.json
npm run benchmark:self-consistency -- --repetitions 3 --output build/performance-ci/input/self-consistency.json
npm run verify:performance-reproducibility -- --output build/performance-ci/input/build-reproducibility.json
```

The npm aliases build their required artifacts before measuring. GitHub Actions builds the graph once and invokes the measurement scripts directly so redundant build time does not contaminate job cost or benchmark timing.
