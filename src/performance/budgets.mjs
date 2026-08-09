import { createHash } from "node:crypto";

import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";
import {
  performanceMethodologySha256,
  summarizeMeasurementForks,
  validatePerformanceMethodology,
} from "./methodology.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const shaPattern = /^[a-f0-9]{64}$/;

export class PerformanceBudgetError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PerformanceBudgetError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new PerformanceBudgetError(code, message, details);
};

const samples = (id, label, category, unit, targetProfile, cacheProfile, values) => {
  if (!Array.isArray(values) || values.length === 0 || values.some(value => (
    !Number.isFinite(value) || value < 0
  ))) fail("invalid-metric-samples", `${id} has invalid samples`, { id, values });
  return Object.freeze({
    id,
    label,
    category,
    unit,
    targetProfile,
    cacheProfile,
    samples: Object.freeze([...values]),
  });
};

const findScalingRun = (suite, profile, count) => {
  const run = suite.runs.find(candidate => (
    candidate.profile === profile && candidate.graph.libraryCount === count
  ));
  if (!run) fail("missing-scaling-run", `missing ${profile} scaling run for ${count} libraries`);
  return run;
};

const wasmBytesAt = (run, phase = run.profile === "isolated"
  ? "after-isolated-load-and-initialize"
  : "after-load-and-initialize") => {
  const snapshot = run.memory.phaseSnapshots.find(candidate => candidate.phase === phase);
  if (!snapshot) fail("missing-memory-snapshot", `${run.profile}/${run.graph.libraryCount} lacks ${phase}`);
  return snapshot.wasmMemoryBytes;
};

const overheadMetrics = suite => {
  const metrics = [];
  for (const [name, value] of Object.entries(suite.firstCallsNs)) {
    metrics.push(samples(
      `overhead.first-call.${name}.duration`,
      `First ${name} call`,
      "first-call",
      "nanoseconds",
      "javascript-node",
      "cold-process-warm-filesystem",
      [value],
    ));
  }
  for (const [name, summary] of Object.entries(suite.operations)) {
    const category = name === "boxConstructReadDispose"
      ? "allocation-disposal"
      : /callback|promise|cancellation/i.test(name) ? "async-callback" : "steady-call";
    metrics.push(samples(
      `overhead.warm.${name}.duration`,
      `Warm ${name}`,
      category,
      "nanoseconds",
      "javascript-node",
      "warm-runtime-warm-filesystem",
      summary.samplesNs,
    ));
  }
  return metrics;
};

const lifecycleMetrics = suite => {
  const metrics = [
    samples(
      "lifecycle.memory.wasm-high-water.bytes",
      "Lifecycle Wasm memory high-water",
      "memory",
      "bytes",
      "javascript-node",
      "warm-runtime-warm-filesystem",
      [suite.memory.highWater.wasmMemoryBytes],
    ),
    samples(
      "lifecycle.memory.wasm-retained.bytes",
      "Lifecycle retained Wasm memory",
      "memory",
      "bytes",
      "javascript-node",
      "warm-runtime-warm-filesystem",
      [suite.memory.retained.wasmMemoryBytes],
    ),
  ];
  for (const [name, value] of Object.entries(suite.lifecycle.retained)) {
    metrics.push(samples(
      `lifecycle.retained.${name}.count`,
      `Retained ${name}`,
      "lifecycle-state",
      "count",
      "javascript-node",
      "warm-runtime-warm-filesystem",
      [value],
    ));
  }
  return metrics;
};

const spatialMetrics = suite => {
  const metrics = [];
  for (const run of suite.runs) {
    const profile = run.profile;
    metrics.push(samples(
      `spatial.${profile}.startup.module-factory.duration`,
      `${profile} spatial module factory`,
      "startup",
      "nanoseconds",
      profile,
      "cold-process-warm-filesystem",
      run.composition.moduleFactoryNs,
    ));
    for (const [library, duration] of Object.entries(run.composition.libraryLoadNs)) {
      metrics.push(samples(
        `spatial.${profile}.startup.library-load.${library}.duration`,
        `${profile} ${library} load`,
        "startup",
        "nanoseconds",
        profile,
        "cold-process-warm-filesystem",
        [duration],
      ));
    }
    for (const [name, value] of Object.entries(run.timing.firstCallsNs)) {
      metrics.push(samples(
        `spatial.${profile}.first-call.${name}.duration`,
        `${profile} first ${name} call`,
        name === "consumerRangeChecksum" ? "cross-library-handoff" : "first-call",
        "nanoseconds",
        profile,
        "cold-process-warm-filesystem",
        [value],
      ));
    }
    for (const [name, summary] of Object.entries(run.timing.operations)) {
      metrics.push(samples(
        `spatial.${profile}.warm.${name}.duration`,
        `${profile} warm ${name}`,
        name === "consumerRangeChecksum" ? "cross-library-handoff" : "algorithm",
        "nanoseconds",
        profile,
        "warm-runtime-warm-filesystem",
        summary.samplesNs,
      ));
    }
    metrics.push(samples(
      `spatial.${profile}.memory.final-wasm.bytes`,
      `${profile} final Wasm memory`,
      "memory",
      "bytes",
      profile,
      "warm-runtime-warm-filesystem",
      [run.memory.finalWasmBytes],
    ));
  }
  return metrics;
};

const scalingMetrics = suite => {
  const metrics = [];
  for (const run of suite.runs) {
    const profile = run.profile;
    const count = run.graph.libraryCount;
    for (const phase of ["moduleFactory", "libraryLoad", "firstNativeCall"]) {
      metrics.push(samples(
        `scaling.${profile}.count-${count}.${phase}.duration`,
        `${profile} ${count}-library ${phase}`,
        phase === "firstNativeCall" ? "first-call" : "composition",
        "nanoseconds",
        profile,
        "cold-process-warm-filesystem",
        run.phases[phase].samplesNs,
      ));
    }
    metrics.push(samples(
      `scaling.${profile}.count-${count}.artifacts.bytes`,
      `${profile} ${count}-library artifact closure`,
      "package-size",
      "bytes",
      profile,
      "cold-process-warm-filesystem",
      [run.bytes.totalBytes],
    ));
    metrics.push(samples(
      `scaling.${profile}.count-${count}.wasm-memory.bytes`,
      `${profile} ${count}-library Wasm memory`,
      "memory",
      "bytes",
      profile,
      "warm-runtime-warm-filesystem",
      [wasmBytesAt(run)],
    ));
  }
  for (const profile of ["lazy", "startup", "final-static", "isolated"]) {
    const one = findScalingRun(suite, profile, 1);
    const fifty = findScalingRun(suite, profile, 50);
    metrics.push(samples(
      `scaling.${profile}.incremental-artifact.bytes-per-library`,
      `${profile} incremental artifact bytes per library`,
      "per-library-cost",
      "bytes",
      profile,
      "cold-process-warm-filesystem",
      [(fifty.bytes.totalBytes - one.bytes.totalBytes) / 49],
    ));
    metrics.push(samples(
      `scaling.${profile}.incremental-wasm-memory.bytes-per-library`,
      `${profile} incremental Wasm memory per library`,
      "per-library-cost",
      "bytes",
      profile,
      "warm-runtime-warm-filesystem",
      [(wasmBytesAt(fifty) - wasmBytesAt(one)) / 49],
    ));
    metrics.push(samples(
      `scaling.${profile}.count-50.average-library-load.duration-per-library`,
      `${profile} average load duration per library at 50 libraries`,
      "per-library-cost",
      "nanoseconds",
      profile,
      "cold-process-warm-filesystem",
      [fifty.phases.libraryLoad.totalNs / 50],
    ));
  }
  return metrics;
};

export const extractPerformanceMetrics = fork => {
  if (!fork?.suites) fail("invalid-fork", "performance fork lacks suites");
  const metrics = [
    ...overheadMetrics(fork.suites.overhead),
    ...lifecycleMetrics(fork.suites.lifecycle),
    ...spatialMetrics(fork.suites.spatial),
    ...scalingMetrics(fork.suites.scaling),
  ].sort((left, right) => left.id.localeCompare(right.id));
  const ids = metrics.map(metric => metric.id);
  if (new Set(ids).size !== ids.length) fail("duplicate-metric", "performance metric ids are not unique");
  return Object.freeze(metrics);
};

const artifactCatalog = fork => {
  const artifacts = [];
  artifacts.push(...fork.suites.overhead.artifacts, ...fork.suites.lifecycle.artifacts);
  for (const run of fork.suites.spatial.runs) artifacts.push(...run.artifacts);
  for (const run of fork.suites.scaling.runs) artifacts.push(...run.artifacts);
  const catalog = new Map();
  for (const artifact of artifacts) {
    const existing = catalog.get(artifact.path);
    if (existing && (existing.sha256 !== artifact.sha256 || existing.bytes !== artifact.bytes)) {
      fail("artifact-identity-conflict", `${artifact.path} changed inside one fork`);
    }
    catalog.set(artifact.path, Object.freeze({
      path: artifact.path,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
    }));
  }
  return Object.freeze([...catalog.values()].sort((left, right) => left.path.localeCompare(right.path)));
};

const workloadIdentity = fork => Object.freeze(fork.suites.spatial.runs.map(run => Object.freeze({
  profile: run.profile,
  id: run.workload.id,
  contentSha256: run.workload.contentSha256,
  resultSha256: run.workload.resultSha256,
  manifestSha256: run.workload.manifestSha256,
})).sort((left, right) => left.profile.localeCompare(right.profile)));

const sameCanonical = (left, right) => canonicalizeJsonValue(left) === canonicalizeJsonValue(right);

const unitNeutralSummary = summary => Object.freeze({
  metricIdentity: summary.metricIdentity,
  resultIdentity: summary.resultIdentity,
  validForks: summary.validForks,
  forkSummaries: Object.freeze(summary.forkSummaries.map(fork => Object.freeze({
    id: fork.id,
    samples: fork.samples,
    minimum: fork.minimumNs,
    median: fork.medianNs,
    p95: fork.p95Ns,
    maximum: fork.maximumNs,
    medianAbsoluteDeviation: fork.medianAbsoluteDeviationNs,
    rawSamples: fork.samplesNs,
  }))),
  headline: Object.freeze({
    median: summary.headline.medianNs,
    p95: summary.headline.p95Ns,
    medianConfidenceInterval: Object.freeze({
      level: summary.headline.medianConfidenceInterval.level,
      lower: summary.headline.medianConfidenceInterval.lowerNs,
      upper: summary.headline.medianConfidenceInterval.upperNs,
    }),
    p95ConfidenceInterval: Object.freeze({
      level: summary.headline.p95ConfidenceInterval.level,
      lower: summary.headline.p95ConfidenceInterval.lowerNs,
      upper: summary.headline.p95ConfidenceInterval.upperNs,
    }),
  }),
});

export const assemblePerformanceBaseline = ({
  methodology,
  environmentReport,
  forks,
  invalidForks = [],
  rawForkFiles,
  reproductionCommand,
}) => {
  validatePerformanceMethodology(methodology);
  if (!environmentReport?.baselineEligible || !environmentReport.accepted) {
    fail("environment-not-budget-eligible", "the environment report cannot authorize a baseline");
  }
  if (!Array.isArray(forks) || forks.length !== methodology.sampling.validForks) {
    fail("invalid-fork-count", "baseline requires the exact approved valid fork count", {
      expected: methodology.sampling.validForks,
      actual: forks?.length ?? null,
    });
  }
  if (invalidForks.length > methodology.sampling.maximumInvalidForks) {
    fail("too-many-invalid-forks", "baseline exceeded the invalid fork allowance");
  }
  if (!Array.isArray(rawForkFiles) || rawForkFiles.length !== forks.length) {
    fail("missing-raw-forks", "every valid fork requires an immutable raw record");
  }
  const methodologySha256 = performanceMethodologySha256(methodology);
  const firstMetrics = extractPerformanceMetrics(forks[0]);
  const metricShape = firstMetrics.map(({ id, label, category, unit, targetProfile, cacheProfile }) => ({
    id, label, category, unit, targetProfile, cacheProfile,
  }));
  const artifacts = artifactCatalog(forks[0]);
  const workloads = workloadIdentity(forks[0]);
  const sourceCommit = forks[0].source.commit;
  for (const [index, fork] of forks.entries()) {
    if (!fork.correctness?.accepted || fork.source.dirty || fork.source.commit !== sourceCommit) {
      fail("invalid-fork-source", `fork ${index + 1} is incorrect, dirty, or from another revision`);
    }
    const shape = extractPerformanceMetrics(fork).map(({
      id, label, category, unit, targetProfile, cacheProfile,
    }) => ({ id, label, category, unit, targetProfile, cacheProfile }));
    if (!sameCanonical(shape, metricShape)) fail("metric-shape-drift", `fork ${index + 1} changed metric coverage`);
    if (!sameCanonical(artifactCatalog(fork), artifacts)) fail("artifact-drift", `fork ${index + 1} changed artifacts`);
    if (!sameCanonical(workloadIdentity(fork), workloads)) fail("workload-drift", `fork ${index + 1} changed workloads`);
  }
  const comparisonIdentity = Object.freeze({
    methodologySha256,
    environmentId: environmentReport.observation.environmentId,
    identityInputs: methodology.identityInputs,
    metricShape,
    workloads,
  });
  const comparisonSha256 = sha256(canonicalizeJsonValue(comparisonIdentity));
  const resultIdentity = sha256(canonicalizeJsonValue({
    comparisonSha256,
    sourceCommit,
    artifacts,
  }));
  const extracted = forks.map(extractPerformanceMetrics);
  const summaries = firstMetrics.map((metric, metricIndex) => Object.freeze({
    id: metric.id,
    label: metric.label,
    category: metric.category,
    unit: metric.unit,
    targetProfile: metric.targetProfile,
    cacheProfile: metric.cacheProfile,
    summary: unitNeutralSummary(summarizeMeasurementForks({
      methodology,
      metricIdentity: metric.id,
      resultIdentity,
      forks: extracted.map((forkMetrics, forkIndex) => ({
        id: forks[forkIndex].forkId,
        samplesNs: forkMetrics[metricIndex].samples,
      })),
    })),
  }));
  return Object.freeze({
    schemaVersion: 1,
    kind: "lean-bridge-performance-baseline",
    id: `${environmentReport.observation.environmentId}/${sourceCommit.slice(0, 12)}/${methodologySha256.slice(0, 12)}`,
    status: "collected",
    recordedAt: new Date().toISOString(),
    methodology: Object.freeze({ id: methodology.id, sha256: methodologySha256 }),
    environment: Object.freeze({
      id: environmentReport.observation.environmentId,
      classification: environmentReport.classification,
      reportSha256: sha256(canonicalizeJsonValue(environmentReport)),
      observation: environmentReport.observation,
    }),
    source: Object.freeze({ commit: sourceCommit, dirty: false }),
    identity: Object.freeze({ comparisonSha256, resultIdentity, inputs: comparisonIdentity }),
    artifacts,
    collection: Object.freeze({
      validForks: forks.length,
      invalidForks: Object.freeze(invalidForks),
      maximumInvalidForks: methodology.sampling.maximumInvalidForks,
      rawForkFiles: Object.freeze(rawForkFiles),
      reproductionCommand,
    }),
    metrics: Object.freeze(summaries),
    correctness: Object.freeze({ accepted: true, checkedForks: forks.length }),
    limitations: Object.freeze([
      "This baseline applies only to its named reference environment and exact methodology.",
      "Host process memory remains supplemental. Wasm pages and bridge live-state counters are authoritative.",
      "Network download timing is outside this local execution profile.",
    ]),
  });
};

const roundCeiling = value => {
  if (value === 0) return 0;
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.ceil(value / magnitude) * magnitude;
};

const relativeThresholdFor = metric => {
  if (metric.unit === "count") return 0;
  if (metric.category === "memory" || metric.category === "package-size") return 0.05;
  if (metric.category === "startup" || metric.category === "first-call" || metric.category === "composition") {
    return 0.25;
  }
  return 0.15;
};

const absoluteMultiplierFor = metric => {
  if (metric.unit === "count") return metric.summary.headline.p95 === 0 ? 1 : 1.05;
  if (metric.category === "memory" && metric.summary.headline.p95 === 0) return 1;
  if (metric.unit === "bytes") return 1.05;
  if (metric.category === "startup" || metric.category === "first-call" || metric.category === "composition") {
    return 2;
  }
  return 1.5;
};

export const derivePerformanceBudget = ({
  baseline,
  baselinePath,
  baselineSha256,
  reviewedBy,
  rationale,
  reviewedAt = new Date().toISOString(),
  previousBudget = null,
}) => {
  if (!baseline?.correctness?.accepted || baseline.status !== "collected") {
    fail("invalid-baseline", "only an accepted collected baseline can define budgets");
  }
  if (!shaPattern.test(baselineSha256)) fail("invalid-baseline-sha", "baseline SHA-256 is invalid");
  if (!reviewedBy || !rationale) fail("missing-budget-review", "budget approval requires a reviewer and rationale");
  const previousHistory = previousBudget
    ? previousBudget.history.map(entry => ({ ...entry }))
    : [];
  if (previousBudget) {
    validatePerformanceBudget(previousBudget);
    for (const entry of previousHistory) {
      if (entry.status === "active") entry.status = "superseded";
    }
  }
  const history = Object.freeze([
    ...previousHistory.map(Object.freeze),
    Object.freeze({
      baselineId: baseline.id,
      path: baselinePath,
      sha256: baselineSha256,
      sourceCommit: baseline.source.commit,
      status: "active",
      reviewedAt,
      reviewedBy,
      rationale,
    }),
  ]);
  const thresholds = baseline.metrics.map(metric => {
    const headline = metric.summary.headline.p95;
    const uncertaintyUpper = metric.summary.headline.p95ConfidenceInterval.upper;
    const observedCeiling = Math.max(headline, uncertaintyUpper);
    return Object.freeze({
      metricId: metric.id,
      label: metric.label,
      category: metric.category,
      unit: metric.unit,
      targetProfile: metric.targetProfile,
      statistic: "p95",
      absoluteCeiling: roundCeiling(observedCeiling * absoluteMultiplierFor(metric)),
      relativeRegressionRatio: relativeThresholdFor(metric),
      required: true,
    });
  });
  const budget = Object.freeze({
    schemaVersion: 1,
    kind: "lean-bridge-performance-budget",
    id: `${baseline.environment.id}/budget-v${history.length}`,
    status: "active",
    methodologySha256: baseline.methodology.sha256,
    environmentId: baseline.environment.id,
    activeBaseline: Object.freeze({
      id: baseline.id,
      path: baselinePath,
      sha256: baselineSha256,
    }),
    history,
    thresholds: Object.freeze(thresholds),
    policy: Object.freeze({
      comparison: "like-for-like-only",
      relativeRegression: "fail-only-when-confidence-intervals-do-not-overlap-and-practical-threshold-is-exceeded",
      absoluteCeiling: "hard-failure",
      missingMetric: "hard-failure",
      baselineUpdate: "append-history-with-reviewer-rationale-and-retain-prior-record",
    }),
  });
  validatePerformanceBudget(budget);
  return budget;
};

export const validatePerformanceBudget = budget => {
  if (budget?.schemaVersion !== 1 || budget.kind !== "lean-bridge-performance-budget") {
    fail("unsupported-budget", "performance budget version or kind is unsupported");
  }
  if (budget.status !== "active" || !shaPattern.test(budget.methodologySha256)) {
    fail("invalid-budget", "performance budget is not active or lacks methodology identity");
  }
  if (!Array.isArray(budget.history) || budget.history.length === 0) {
    fail("invalid-budget-history", "performance budget must retain baseline history");
  }
  const active = budget.history.filter(entry => entry.status === "active");
  if (active.length !== 1 || active[0].baselineId !== budget.activeBaseline.id) {
    fail("invalid-budget-history", "performance budget must have exactly one matching active baseline");
  }
  for (const entry of budget.history) {
    if (!entry.reviewedBy || !entry.rationale || !shaPattern.test(entry.sha256)) {
      fail("unreviewed-baseline", `baseline ${entry.baselineId} lacks retained review evidence`);
    }
  }
  if (!Array.isArray(budget.thresholds) || budget.thresholds.length === 0) {
    fail("invalid-budget", "performance budget must contain thresholds");
  }
  const ids = new Set();
  for (const threshold of budget.thresholds) {
    if (ids.has(threshold.metricId)) fail("duplicate-threshold", `duplicate threshold ${threshold.metricId}`);
    ids.add(threshold.metricId);
    if (!threshold.required || threshold.statistic !== "p95") {
      fail("weakened-threshold", `${threshold.metricId} must remain required and use p95`);
    }
    if (!Number.isFinite(threshold.absoluteCeiling) || threshold.absoluteCeiling < 0) {
      fail("invalid-threshold", `${threshold.metricId} has an invalid absolute ceiling`);
    }
    if (!Number.isFinite(threshold.relativeRegressionRatio) || threshold.relativeRegressionRatio < 0) {
      fail("invalid-threshold", `${threshold.metricId} has an invalid relative threshold`);
    }
  }
  return budget;
};

const artifactDifferences = (baseline, candidate) => {
  const left = new Map(baseline.artifacts.map(value => [value.path, value]));
  const right = new Map(candidate.artifacts.map(value => [value.path, value]));
  return [...new Set([...left.keys(), ...right.keys()])].sort().flatMap(path => {
    const before = left.get(path) ?? null;
    const after = right.get(path) ?? null;
    return sameCanonical(before, after) ? [] : [{ path, baseline: before, candidate: after }];
  });
};

export const comparePerformanceCandidate = ({ baseline, candidate, budget, baselineSha256 }) => {
  validatePerformanceBudget(budget);
  if (budget.activeBaseline.id !== baseline.id || budget.activeBaseline.sha256 !== baselineSha256) {
    fail("baseline-identity-mismatch", "the supplied baseline does not match the active reviewed budget");
  }
  const compatibilityIssues = [];
  if (candidate.methodology.sha256 !== budget.methodologySha256) compatibilityIssues.push("methodology");
  if (candidate.environment.id !== budget.environmentId) compatibilityIssues.push("environment");
  if (candidate.identity.comparisonSha256 !== baseline.identity.comparisonSha256) {
    compatibilityIssues.push("result-vector");
  }
  const baselineMetrics = new Map(baseline.metrics.map(metric => [metric.id, metric]));
  const candidateMetrics = new Map(candidate.metrics.map(metric => [metric.id, metric]));
  const checks = [];
  for (const threshold of budget.thresholds) {
    const before = baselineMetrics.get(threshold.metricId);
    const after = candidateMetrics.get(threshold.metricId);
    if (!before || !after) {
      checks.push(Object.freeze({
        metricId: threshold.metricId,
        label: threshold.label,
        status: "fail",
        reason: "missing-required-metric",
        baseline: before?.summary.headline[threshold.statistic] ?? null,
        candidate: after?.summary.headline[threshold.statistic] ?? null,
        absoluteCeiling: threshold.absoluteCeiling,
        relativeRegressionRatio: threshold.relativeRegressionRatio,
        observedRegressionRatio: null,
        statisticalSignificance: false,
        practicalSignificance: false,
      }));
      continue;
    }
    const baselineValue = before.summary.headline[threshold.statistic];
    const candidateValue = after.summary.headline[threshold.statistic];
    const absoluteFailure = candidateValue > threshold.absoluteCeiling;
    const observedRegressionRatio = baselineValue === 0
      ? candidateValue === 0 ? 0 : null
      : (candidateValue - baselineValue) / baselineValue;
    const practicalSignificance = baselineValue === 0
      ? candidateValue > 0
      : observedRegressionRatio > threshold.relativeRegressionRatio;
    const baselineInterval = before.summary.headline.p95ConfidenceInterval;
    const candidateInterval = after.summary.headline.p95ConfidenceInterval;
    const statisticalSignificance = candidateInterval.lower > baselineInterval.upper;
    const relativeFailure = practicalSignificance && statisticalSignificance;
    checks.push(Object.freeze({
      metricId: threshold.metricId,
      label: threshold.label,
      status: absoluteFailure || relativeFailure ? "fail" : "pass",
      reason: absoluteFailure
        ? "absolute-ceiling-exceeded"
        : relativeFailure ? "statistically-and-practically-significant-regression" : "within-budget",
      baseline: baselineValue,
      candidate: candidateValue,
      absoluteCeiling: threshold.absoluteCeiling,
      relativeRegressionRatio: threshold.relativeRegressionRatio,
      observedRegressionRatio,
      statisticalSignificance,
      practicalSignificance,
    }));
  }
  const failed = checks.filter(check => check.status === "fail");
  const accepted = compatibilityIssues.length === 0 && failed.length === 0;
  return Object.freeze({
    schemaVersion: 1,
    kind: "lean-bridge-performance-regression-report",
    recordedAt: new Date().toISOString(),
    status: accepted ? "pass" : "fail",
    accepted,
    budget: Object.freeze({ id: budget.id, baselineId: baseline.id }),
    source: Object.freeze({ baseline: baseline.source, candidate: candidate.source }),
    compatibility: Object.freeze({
      accepted: compatibilityIssues.length === 0,
      issues: Object.freeze(compatibilityIssues),
      baselineComparisonSha256: baseline.identity.comparisonSha256,
      candidateComparisonSha256: candidate.identity.comparisonSha256,
    }),
    differences: Object.freeze({
      environment: sameCanonical(baseline.environment.observation, candidate.environment.observation)
        ? [] : [{ baseline: baseline.environment.observation, candidate: candidate.environment.observation }],
      artifacts: Object.freeze(artifactDifferences(baseline, candidate)),
    }),
    summary: Object.freeze({
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
    }),
    checks: Object.freeze(checks),
    explanation: accepted
      ? "Every required metric is present and remains inside its reviewed absolute and relative budget."
      : "The report names each failed metric, its baseline and candidate values, its ceiling, and whether the change was statistically and practically significant.",
  });
};

export const performanceRecordSha256 = value => sha256(canonicalizeJsonValue(value));
