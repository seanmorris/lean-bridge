# Reproducible performance methodology

Status: approved for baseline collection. The methodology fixes how the project collects and compares performance evidence before node 794 defines release thresholds.

## Reference identity

`lean-bridge/reference-methodology@1` has SHA-256 `564493a81cb8f2938286a2d74ef38bf0611ecfecf70c94bacdfc70bf56bc3c7e`.

The policy binds each result to the source revision, methodology hash, Lean and Emscripten closure, graph lock, compiled artifact hashes, corpus, workload, environment, and cache profile. Five locked input files must match before an environment report can pass:

| Input | SHA-256 |
|---|---|
| `package-lock.json` | `5237a3e4037f48e675a571d95d3fa854eb64008fb7accd6a49cdb7d85079a8da` |
| `flake.lock` | `81cffbee9e26c9a7a8f7a2aa6257252cc2efb1895513e4894d5a7c5257df7dc5` |
| `poc/lean-link-spike/graph-lock.json` | `7a10491995e8023cb271521499049834437f6bddec7c2ce26f9a7aadf6156789` |
| `poc/performance/corpus.v1.json` | `687e331391e60ef0fb49f1fc84e73dbdb3b70438646adf67d7c797160d5145ea` |
| `poc/performance/workloads.v1.json` | `2593995175c9ba0b81e5155b882b8ddf39f08f10cce4c1a189c2312d31fd2ff8` |

The toolchain identity fixes Lean 4.32.2, Lean commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`, patch set `743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3`, Emscripten 6.0.6, Emscripten commit `ce75e06884093bcefb86a6b8fd56a5d62a4cc245`, and libuv commit `e9f29cb984231524e3931aa0ae2c5dae1a32884e`.

## Environment classes

| Environment | Use | Hardware and runtime identity |
|---|---|---|
| `reference-linux-x64-i7-7700k-v1` | baseline collection | Debian 12, Linux 6.1.0-31-amd64, Intel i7-7700K, 8 logical CPUs, at least 24,000,000,000 memory bytes, Node 22.23.1, Playwright 1.62.1, Chrome for Testing 151.0.7922.34 |
| `shared-ci-linux-x64-v1` | informational reports | x64, exact Node, Playwright, and Chrome versions; runner CPU, OS, kernel, and governor are reported with each result |

The reference host requires an exclusive runner, the performance CPU governor, no network inside timed regions, zero swap input or output during a fork, and load average no greater than one per logical CPU. A mismatch rejects the environment report. Shared CI can publish the same metrics but cannot create or update a baseline.

## Timed execution

Artifact compilation happens before timing inside the pinned Nix closure. Every measurement fork starts a fresh process. Profiles use a deterministic balanced order so one profile does not always inherit the same thermal or cache position.

The methodology defines two cache profiles:

- `cold-process-warm-filesystem` starts a new process with already built local artifacts;
- `warm-runtime-warm-filesystem` measures the generated native API after the workload's declared warmup.

First calls remain separate from steady-state samples. Browser download and network timing require another named profile. They cannot be folded into local module creation.

## Forks, samples, and uncertainty

An accepted result contains nine valid process forks. The runner may replace no more than two invalid forks. It retains every sample from each valid fork. There is no numerical outlier trimming.

Every fork reports minimum, median, p95, maximum, median absolute deviation, and raw samples. Headline values are the median of fork medians and the median of fork p95 values. Deterministic fork-level bootstrap resampling produces 95 percent confidence intervals from 10,000 resamples. The seed derives from the methodology, result, and metric identities, so another reviewer calculates the same interval.

A later regression gate must compare the same environment, methodology, workload, artifacts, and cache profile. It may fail only when a change is statistically significant and exceeds the practical threshold approved by node 794.

The earlier three-run self-consistency record does not become a baseline retroactively. It proves semantic stability and exposes timing variance. Baseline collection must satisfy the nine-fork policy.

## Noise and invalid forks

Each fork records load average per logical CPU, CPU governor, logical CPU count, swap input and output delta, clock monotonicity, and process exit status before it can contribute samples. A failed limit invalidates the whole fork. The runner does not delete individual slow samples. If more than two forks fail, the result cannot claim baseline eligibility.

## Memory and lifecycle

Wasm bytes and pages, runtime count, resources, closures, callbacks, pending operations, and iterators are authoritative. Every authoritative live count must return to zero after each workload.

Process RSS, JavaScript heap, external memory, and array buffers are supplemental because Node and its allocator own part of those values. A host-memory run uses three explicit garbage-collection cycles before its baseline and after cleanup. Explicit collection never changes the Wasm or ownership result. Finalizer correctness uses the deterministic injected finalizer rather than waiting for wall-clock garbage collection.

## Clean environment records

Commit `cfae0ca30804bf6aff748223d66c4c189641ba3a` produced two clean reports.

The reference report matched every hardware, OS, runtime, input, and noise constraint with zero issues. The record is 2,282 bytes with SHA-256 `af328d513d9f07770f1f9c303cd2e1beba765b245b4d1b8d31be5a50932b3028`.

The shared-CI report matched its declared constraints and was classified `informational-only`. It cannot authorize a baseline. The record is 2,266 bytes with SHA-256 `2153f5546953b39f17c43e708832f261d2c55e0402e03f5d6b483008f06b04f1`.

## Commands

```sh
npm run test:performance-methodology
npm run verify:performance-methodology -- \
  --exclusive \
  --network-disabled \
  --output build/performance-methodology/reference.json
npm run verify:performance-methodology -- \
  --environment shared-ci-linux-x64-v1 \
  --network-disabled \
  --output build/performance-methodology/shared-ci.json
```
