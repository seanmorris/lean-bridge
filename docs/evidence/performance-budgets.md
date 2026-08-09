# Versioned performance budgets and regression gates

Status: baseline collection infrastructure verified. The reference runner must produce nine accepted fresh-process forks before the project publishes the first numeric budget.

## Result vector

The collector executes generated public APIs through one worker process per fork. Each fork covers:

- module creation and component loading for lazy, startup, final-static, and isolated runtime profiles;
- first calls for functions, classes, callbacks, closures, Promises, iterators, and spatial operations;
- steady-state scalar, copied-value, callback, nested callback, Promise, iterator, allocation, read, and disposal operations;
- a retained spatial index passed into an independently compiled consumer library;
- authoritative Wasm memory and retained bridge state;
- artifact size, startup, load, first-call, and memory results for 1, 3, 10, and 50 independently compiled libraries; and
- incremental artifact bytes, incremental Wasm bytes, and average 50-library load duration per library.

The worker rotates suite and profile order deterministically across forks. A profile does not always inherit the same process position. Every workload call uses the generated API returned by the library loader.

## Baseline collection

The collection pipeline performs these steps:

1. Validate the approved methodology and all locked identity inputs.
2. Reject a dirty source tree or an ineligible host.
3. Start a fresh Node process with explicit garbage collection for each fork.
4. Record load per logical CPU, swap counters, monotonic clock values, process status, suite order, and profile order.
5. Retain every raw sample from nine accepted forks.
6. Reject the collection after more than two invalid forks.
7. Calculate median-of-fork medians, median-of-fork p95 values, and deterministic 95 percent confidence intervals.
8. Write an immutable baseline record plus individually hashed raw fork files.

The promotion command refuses to overwrite an existing baseline directory. A later baseline receives another directory and another history entry.

## Budget policy

Every metric receives an absolute ceiling and a relative regression threshold. Absolute ceilings fail immediately. Relative regressions fail only when the candidate exceeds the practical threshold and its 95 percent confidence interval starts above the baseline interval.

Warm calls use a 15 percent relative threshold. Startup, first-call, and composition metrics use 25 percent. Memory and artifact sizes use 5 percent. The initial absolute ceilings derive from the observed upper confidence bound. Time-sensitive warm operations receive 50 percent headroom. Startup and first-call measurements receive 100 percent headroom because their variance is larger. Byte counts receive 5 percent headroom. Retained counts and retained Wasm bytes remain at zero when the baseline establishes zero.

Each threshold is required. Removing a workload or metric creates a hard failure. The comparator also rejects changes to the methodology, reference environment, workload identities, and result-vector shape before it evaluates numbers.

## Review and retained history

A budget cannot become active without a reviewer, rationale, source revision, baseline path, and baseline SHA-256. Updating the baseline marks the previous history entry as superseded and retains its path and hash. The budget manifest always contains exactly one active baseline.

Failure reports contain text status in addition to machine fields. Each failed metric names its baseline value, candidate value, absolute ceiling, observed ratio, practical result, and statistical result. The report separately lists source, artifact, environment, and comparison-identity differences.

## Commands

Build the benchmark artifacts before collecting a baseline:

```sh
npm run build:lean-link-spike
npm run build:performance-wasm
npm run build:performance-scaling
npm run benchmark:baseline -- \
  --environment reference-linux-x64-i7-7700k-v1 \
  --exclusive \
  --network-disabled \
  --output build/performance-baseline/reference-v1
```

Promote a collected baseline without overwriting retained evidence:

```sh
node scripts/promote-performance-baseline.mjs \
  --source build/performance-baseline/reference-v1 \
  --destination poc/performance/baselines/reference-linux-x64-i7-7700k-v1/v1
```

The budget derivation and comparison commands are:

```sh
npm run performance:derive-budget -- \
  --baseline poc/performance/baselines/reference-linux-x64-i7-7700k-v1/v1/baseline.json \
  --baseline-path poc/performance/baselines/reference-linux-x64-i7-7700k-v1/v1/baseline.json \
  --reviewed-by Codex \
  --rationale "Initial POC budget from nine accepted reference forks." \
  --output poc/performance/budgets/reference-linux-x64-i7-7700k-v1.v1.json

npm run performance:check-regression -- \
  --baseline poc/performance/baselines/reference-linux-x64-i7-7700k-v1/v1/baseline.json \
  --candidate build/performance-baseline/candidate/baseline.json \
  --budget poc/performance/budgets/reference-linux-x64-i7-7700k-v1.v1.json \
  --output build/performance-baseline/regression-report.json
```

The public schema identifiers use the non-networked `urn:lean-bridge:` namespace. They do not claim a project website or require schema resolution over the network.
