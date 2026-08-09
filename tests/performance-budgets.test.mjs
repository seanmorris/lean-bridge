import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assemblePerformanceBaseline,
  comparePerformanceCandidate,
  derivePerformanceBudget,
  extractPerformanceMetrics,
  validatePerformanceBudget,
} from "../src/performance/budgets.mjs";

const sourceMethodology = JSON.parse(await readFile("poc/performance/methodology.v1.json", "utf8"));
const methodology = structuredClone(sourceMethodology);
methodology.statistics.bootstrapResamples = 1_000;
const digest = "a".repeat(64);
const summary = values => ({
  samples: values.length,
  samplesNs: values,
  minimumNs: Math.min(...values),
  medianNs: values[0],
  p95Ns: values.at(-1),
  maximumNs: Math.max(...values),
  totalNs: values.reduce((sum, value) => sum + value, 0),
});
const artifact = { path: "build/runtime.wasm", bytes: 1000, sha256: digest };

const spatialRun = profile => ({
  profile,
  workload: {
    id: "interactive-clustered-2d",
    contentSha256: digest,
    resultSha256: digest,
    manifestSha256: digest,
  },
  artifacts: [],
  composition: {
    moduleFactoryNs: [1000],
    libraryLoadNs: { "ordered-search": 200, "spatial-index": 300, "spatial-consumer": 400 },
  },
  timing: {
    firstCallsNs: { build: 100, lowerBound: 80, consumerRangeChecksum: 120, dispose: 50 },
    operations: {
      lowerBound: summary([20, 21, 22]),
      consumerRangeChecksum: summary([30, 31, 32]),
    },
  },
  memory: { finalWasmBytes: profile === "islands" ? 3000 : 1000 },
  correctness: { accepted: true },
});

const scalingRun = (profile, count) => {
  const wasm = profile === "isolated" ? count * 1000 : 1000;
  return {
    profile,
    graph: { libraryCount: count },
    artifacts: [],
    bytes: { totalBytes: 1000 + count * 10 },
    phases: {
      moduleFactory: summary([500 + count]),
      libraryLoad: summary([800 + count * 20]),
      firstNativeCall: summary(Array.from({ length: count }, (_, index) => 40 + index)),
    },
    memory: {
      phaseSnapshots: [{ phase: "after-load-and-initialize", wasmMemoryBytes: wasm }],
    },
    correctness: { accepted: true },
  };
};

const makeFork = index => ({
  forkId: `fork-${index + 1}`,
  source: { commit: "1234567890abcdef", dirty: false },
  suites: {
    overhead: {
      firstCallsNs: { Box: 100, deferBoxValue: 200 },
      operations: {
        retainedBoxRead: summary([10 + index, 11 + index, 12 + index]),
        boxConstructReadDispose: summary([20 + index, 21 + index, 22 + index]),
        callback: summary([30 + index, 31 + index, 32 + index]),
        promiseLatency: summary([40 + index, 41 + index, 42 + index]),
      },
      artifacts: [artifact],
      correctness: { accepted: true },
    },
    lifecycle: {
      memory: { highWater: { wasmMemoryBytes: 1000 }, retained: { wasmMemoryBytes: 0 } },
      lifecycle: {
        retained: {
          resources: 0,
          hostValues: 0,
          nativeClosures: 0,
          callbacks: 0,
          pendingOperations: 0,
          iterators: 0,
        },
      },
      artifacts: [artifact],
      correctness: { accepted: true },
    },
    spatial: {
      runs: ["lazy", "startup", "final-static", "islands"].map(spatialRun),
    },
    scaling: {
      runs: [1, 3, 10, 50].flatMap(count => (
        ["lazy", "startup", "final-static", "isolated"].map(profile => scalingRun(profile, count))
      )),
    },
  },
  correctness: { accepted: true },
});

const environmentReport = {
  accepted: true,
  baselineEligible: true,
  classification: "budget-eligible",
  observation: { environmentId: "reference-linux-x64-i7-7700k-v1" },
};
const forks = Array.from({ length: 9 }, (_, index) => makeFork(index));
const rawForkFiles = forks.map(fork => ({
  id: fork.forkId,
  path: `forks/${fork.forkId}.json`,
  bytes: 100,
  sha256: digest,
}));

const makeBaseline = () => assemblePerformanceBaseline({
  methodology,
  environmentReport,
  forks,
  rawForkFiles,
  reproductionCommand: "npm run benchmark:baseline",
});

test("the metric vector covers every budget category and composition count", () => {
  const metrics = extractPerformanceMetrics(forks[0]);
  const categories = new Set(metrics.map(metric => metric.category));
  for (const category of [
    "startup", "first-call", "steady-call", "async-callback", "allocation-disposal",
    "cross-library-handoff", "memory", "per-library-cost", "composition",
  ]) assert.ok(categories.has(category), `missing ${category}`);
  for (const count of [1, 3, 10, 50]) {
    assert.ok(metrics.some(metric => metric.id === `scaling.lazy.count-${count}.libraryLoad.duration`));
  }
  assert.ok(metrics.some(metric => metric.id === "overhead.warm.boxConstructReadDispose.duration"));
  assert.ok(metrics.some(metric => metric.id.includes("consumerRangeChecksum")));
});

test("nine clean forks produce a baseline with raw records and uncertainty", () => {
  const baseline = makeBaseline();
  assert.equal(baseline.collection.validForks, 9);
  assert.equal(baseline.collection.rawForkFiles.length, 9);
  assert.ok(baseline.metrics.length > 100);
  assert.ok(baseline.metrics.every(metric => metric.summary.validForks === 9));
  assert.ok(baseline.metrics.every(metric => (
    metric.summary.headline.p95ConfidenceInterval.level === 0.95
  )));
});

test("reviewed budgets distinguish absolute ceilings from relative thresholds", () => {
  const baseline = makeBaseline();
  const budget = structuredClone(derivePerformanceBudget({
    baseline,
    baselinePath: "poc/performance/baselines/reference/v1/baseline.json",
    baselineSha256: digest,
    reviewedBy: "Codex",
    rationale: "Initial architecture-testing POC budget from nine accepted reference forks.",
    reviewedAt: "2026-08-09T00:00:00.000Z",
  }));
  assert.equal(validatePerformanceBudget(budget), budget);
  assert.equal(budget.thresholds.length, baseline.metrics.length);
  assert.ok(budget.thresholds.every(value => value.required));
  assert.ok(budget.thresholds.every(value => value.absoluteCeiling >= 0));
  assert.ok(budget.thresholds.some(value => value.relativeRegressionRatio === 0.15));
  assert.ok(budget.thresholds.some(value => value.relativeRegressionRatio === 0.25));
});

test("like-for-like results pass and missing required metrics fail", () => {
  const baseline = makeBaseline();
  const budget = derivePerformanceBudget({
    baseline,
    baselinePath: "baseline.json",
    baselineSha256: digest,
    reviewedBy: "Codex",
    rationale: "Initial POC budget.",
  });
  const passing = comparePerformanceCandidate({ baseline, candidate: baseline, budget, baselineSha256: digest });
  assert.equal(passing.accepted, true);
  const incomplete = structuredClone(baseline);
  const removed = incomplete.metrics.pop();
  const failure = comparePerformanceCandidate({ baseline, candidate: incomplete, budget, baselineSha256: digest });
  assert.equal(failure.accepted, false);
  assert.equal(failure.checks.find(check => check.metricId === removed.id).reason, "missing-required-metric");
});

test("relative failures require both statistical and practical significance", () => {
  const baseline = makeBaseline();
  const budget = structuredClone(derivePerformanceBudget({
    baseline,
    baselinePath: "baseline.json",
    baselineSha256: digest,
    reviewedBy: "Codex",
    rationale: "Initial POC budget.",
  }));
  const candidate = structuredClone(baseline);
  const metric = candidate.metrics.find(value => value.id === "overhead.warm.retainedBoxRead.duration");
  const threshold = budget.thresholds.find(value => value.metricId === metric.id);
  threshold.absoluteCeiling = Number.MAX_SAFE_INTEGER;
  metric.summary.headline.p95 *= 2;
  metric.summary.headline.p95ConfidenceInterval.lower = baseline.metrics.find(value => value.id === metric.id)
    .summary.headline.p95ConfidenceInterval.upper + 1;
  metric.summary.headline.p95ConfidenceInterval.upper = metric.summary.headline.p95ConfidenceInterval.lower + 1;
  const failure = comparePerformanceCandidate({ baseline, candidate, budget, baselineSha256: digest });
  const check = failure.checks.find(value => value.metricId === metric.id);
  assert.equal(check.reason, "statistically-and-practically-significant-regression");
  assert.equal(check.statisticalSignificance, true);
  assert.equal(check.practicalSignificance, true);
});

test("baseline updates retain review history and one active record", () => {
  const baseline = makeBaseline();
  const first = derivePerformanceBudget({
    baseline,
    baselinePath: "v1/baseline.json",
    baselineSha256: digest,
    reviewedBy: "Codex",
    rationale: "Initial POC budget.",
  });
  const next = structuredClone(baseline);
  next.id = `${baseline.id}-next`;
  next.source.commit = "fedcba0987654321";
  const second = derivePerformanceBudget({
    baseline: next,
    baselinePath: "v2/baseline.json",
    baselineSha256: "b".repeat(64),
    reviewedBy: "Codex",
    rationale: "Reviewed successor after an intentional runtime optimization.",
    previousBudget: first,
  });
  assert.equal(second.history.length, 2);
  assert.deepEqual(second.history.map(entry => entry.status), ["superseded", "active"]);
  assert.equal(validatePerformanceBudget(second), second);
});

test("performance budget schemas close their public records", async () => {
  for (const path of [
    "schema/performance-baseline.schema.json",
    "schema/performance-budget.schema.json",
    "schema/performance-regression-report.schema.json",
  ]) {
    const schema = JSON.parse(await readFile(path, "utf8"));
    assert.equal(schema.additionalProperties, false, path);
  }
  const budget = JSON.parse(await readFile("schema/performance-budget.schema.json", "utf8"));
  for (const name of ["baselinePointer", "history", "threshold", "policy"]) {
    assert.equal(budget.$defs[name].additionalProperties, false);
  }
});

test("budget tooling cannot reach private bridge dispatch", async () => {
  for (const path of [
    "src/performance/budgets.mjs",
    "scripts/performance-baseline-fork.mjs",
    "scripts/collect-performance-baseline.mjs",
    "scripts/check-performance-regression.mjs",
  ]) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(
      source,
      /\bccall\b|\bcwrap\b|_bridge_|generic\s+(?:invoke|dispatch)|numeric handle/i,
    );
  }
});
