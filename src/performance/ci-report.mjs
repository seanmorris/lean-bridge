import { createHash } from "node:crypto";

import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";

export const performanceCiFamilies = Object.freeze([
  "spatial",
  "scaling",
  "overhead",
  "lifecycle",
  "selfConsistency",
  "buildReproducibility",
]);

export const performanceCiJobIds = Object.freeze([
  "build",
  "spatial",
  "scaling",
  "overhead",
  "lifecycle",
  "reproducibility",
]);

const spatialProfiles = Object.freeze(["lazy", "startup", "final-static", "islands"]);
const scalingProfiles = Object.freeze(["lazy", "startup", "final-static", "isolated"]);
const scalingCounts = Object.freeze([1, 3, 10, 50]);
const overheadOperations = Object.freeze([
  "scalarLeanClosure",
  "retainedBoxRead",
  "boxConstructReadDispose",
  "canonicalIdentityCache",
  "copiedRecordSmall",
  "copiedRecord1024Items",
  "copiedRecordPerItem",
  "callback",
  "nestedCallback",
  "iterator256Items",
  "iteratorPerItem",
  "callbackException",
  "promiseLatency",
  "cancellationShutdown",
]);
const overheadFirstCalls = Object.freeze([
  "Box",
  "read",
  "roundTrip",
  "withCallback",
  "makeAdder",
  "closureCall",
  "sequence",
  "deferBoxValue",
]);
const sha256Pattern = /^[0-9a-f]{64}$/;
const commitPattern = /^[0-9a-f]{40}$/;

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const sha256 = value => createHash("sha256").update(value).digest("hex");
const canonicalSha256 = value => sha256(canonicalizeJsonValue(value));

const issue = (code, path, message) => Object.freeze({ code, path, message });

const exactKeys = (value, required, optional, path, issues) => {
  if (!isObject(value)) {
    issues.push(issue("invalid-type", path, `${path} must be an object`));
    return false;
  }
  const expected = new Set([...required, ...optional]);
  for (const key of required) {
    if (!(key in value)) issues.push(issue("missing-field", `${path}.${key}`, `${path}.${key} is required`));
  }
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) issues.push(issue("unknown-field", `${path}.${key}`, `${path}.${key} is not supported`));
  }
  return true;
};

const validateSource = (source, expectedCommit, path, issues) => {
  if (!isObject(source)) {
    issues.push(issue("invalid-source", path, `${path} must identify the measured source`));
    return;
  }
  if (source.commit !== expectedCommit) {
    issues.push(issue("stale-source", `${path}.commit`, `expected ${expectedCommit}, received ${source.commit ?? "missing"}`));
  }
  if (source.dirty !== false) {
    issues.push(issue("dirty-source", `${path}.dirty`, `${path}.dirty must be false`));
  }
};

const validateArtifacts = (artifacts, manifestArtifacts, path, issues) => {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    issues.push(issue("missing-artifacts", path, `${path} must contain at least one artifact`));
    return;
  }
  for (const [index, artifact] of artifacts.entries()) {
    const artifactPath = `${path}[${index}]`;
    if (!isObject(artifact) || typeof artifact.path !== "string") {
      issues.push(issue("invalid-artifact", artifactPath, `${artifactPath} must contain a path`));
      continue;
    }
    if (!Number.isInteger(artifact.bytes) || artifact.bytes < 0 || !sha256Pattern.test(artifact.sha256 ?? "")) {
      issues.push(issue("invalid-artifact", artifactPath, `${artifactPath} must contain exact bytes and SHA-256`));
      continue;
    }
    const expected = manifestArtifacts.get(artifact.path);
    if (!expected) {
      issues.push(issue("unknown-artifact", artifactPath, `${artifact.path} is absent from the build manifest`));
      continue;
    }
    if (artifact.sha256 !== expected.sha256 || artifact.bytes !== expected.bytes) {
      issues.push(issue("artifact-drift", artifactPath, `${artifact.path} does not match the build manifest`));
    }
  }
};

const validateSummary = (value, path, issues) => {
  if (!isObject(value)) {
    issues.push(issue("invalid-summary", path, `${path} must be a timing summary`));
    return;
  }
  for (const field of ["samples", "medianNs", "p95Ns"]) {
    if (!Number.isFinite(value[field]) || value[field] < 0) {
      issues.push(issue("invalid-metric", `${path}.${field}`, `${path}.${field} must be a non-negative number`));
    }
  }
};

const validateSpatial = (record, manifest, manifestArtifacts, issues) => {
  const path = "measurements.spatial";
  if (!isObject(record) || record.schemaVersion !== 1 || record.kind !== "lean-bridge-performance-suite") {
    issues.push(issue("invalid-schema", path, `${path} has an unsupported schema or kind`));
    return;
  }
  if (!Array.isArray(record.runs)) {
    issues.push(issue("invalid-runs", `${path}.runs`, `${path}.runs must be an array`));
    return;
  }
  const seen = new Set();
  for (const [index, run] of record.runs.entries()) {
    const runPath = `${path}.runs[${index}]`;
    if (!isObject(run) || run.schemaVersion !== 1 || run.kind !== "lean-bridge-performance-profile") {
      issues.push(issue("invalid-schema", runPath, `${runPath} has an unsupported schema or kind`));
      continue;
    }
    if (!spatialProfiles.includes(run.profile)) issues.push(issue("unknown-profile", `${runPath}.profile`, `unsupported profile ${run.profile}`));
    if (seen.has(run.profile)) issues.push(issue("duplicate-profile", `${runPath}.profile`, `duplicate profile ${run.profile}`));
    seen.add(run.profile);
    validateSource(run.source, manifest.source.commit, `${runPath}.source`, issues);
    validateArtifacts(run.artifacts, manifestArtifacts, `${runPath}.artifacts`, issues);
    if (run.correctness?.accepted !== true) issues.push(issue("correctness-failed", `${runPath}.correctness`, `${run.profile} correctness was not accepted`));
    if (!isObject(run.workload) || run.workload.manifestSha256 !== manifest.identities.workloads.semanticSha256) {
      issues.push(issue("workload-drift", `${runPath}.workload`, `${run.profile} used a different workload manifest`));
    }
    if (!isObject(run.timing) || !isObject(run.memory) || !isObject(run.composition)) {
      issues.push(issue("missing-metrics", runPath, `${runPath} is missing timing, memory, or composition metrics`));
    }
  }
  for (const profile of spatialProfiles) {
    if (!seen.has(profile)) issues.push(issue("missing-profile", `${path}.runs`, `missing spatial profile ${profile}`));
  }
  if (record.runs.length !== spatialProfiles.length) {
    issues.push(issue("unexpected-run-count", `${path}.runs`, `expected ${spatialProfiles.length} spatial runs`));
  }
};

const validateScaling = (record, manifest, manifestArtifacts, issues) => {
  const path = "measurements.scaling";
  if (!isObject(record) || record.schemaVersion !== 1 || record.kind !== "lean-bridge-library-scaling-suite") {
    issues.push(issue("invalid-schema", path, `${path} has an unsupported schema or kind`));
    return;
  }
  if (!Array.isArray(record.runs)) {
    issues.push(issue("invalid-runs", `${path}.runs`, `${path}.runs must be an array`));
    return;
  }
  const seen = new Set();
  for (const [index, run] of record.runs.entries()) {
    const runPath = `${path}.runs[${index}]`;
    if (!isObject(run) || run.schemaVersion !== 1 || run.kind !== "lean-bridge-library-scaling-profile") {
      issues.push(issue("invalid-schema", runPath, `${runPath} has an unsupported schema or kind`));
      continue;
    }
    const count = run.graph?.libraryCount;
    const key = `${count}:${run.profile}`;
    if (!scalingCounts.includes(count)) issues.push(issue("unknown-library-count", `${runPath}.graph.libraryCount`, `unsupported library count ${count}`));
    if (!scalingProfiles.includes(run.profile)) issues.push(issue("unknown-profile", `${runPath}.profile`, `unsupported profile ${run.profile}`));
    if (seen.has(key)) issues.push(issue("duplicate-run", runPath, `duplicate scaling run ${key}`));
    seen.add(key);
    validateSource(run.source, manifest.source.commit, `${runPath}.source`, issues);
    validateArtifacts(run.artifacts, manifestArtifacts, `${runPath}.artifacts`, issues);
    if (run.correctness?.accepted !== true) issues.push(issue("correctness-failed", `${runPath}.correctness`, `${key} correctness was not accepted`));
    for (const phase of ["artifactRead", "moduleImport", "moduleFactory", "graphResolution", "libraryLoad", "firstNativeCall"]) {
      validateSummary(run.phases?.[phase], `${runPath}.phases.${phase}`, issues);
    }
    if (!isObject(run.memory) || !Array.isArray(run.memory.phaseSnapshots)) {
      issues.push(issue("missing-memory", `${runPath}.memory`, `${key} is missing phase memory snapshots`));
    }
  }
  for (const count of scalingCounts) {
    for (const profile of scalingProfiles) {
      const key = `${count}:${profile}`;
      if (!seen.has(key)) issues.push(issue("missing-scaling-run", `${path}.runs`, `missing scaling run ${key}`));
    }
  }
  if (record.runs.length !== scalingCounts.length * scalingProfiles.length) {
    issues.push(issue("unexpected-run-count", `${path}.runs`, `expected ${scalingCounts.length * scalingProfiles.length} scaling runs`));
  }
};

const validateSingleRecord = ({ record, manifest, manifestArtifacts, issues, family, kind, correctnessPath = "correctness.accepted" }) => {
  const path = `measurements.${family}`;
  if (!isObject(record) || record.schemaVersion !== 1 || record.kind !== kind) {
    issues.push(issue("invalid-schema", path, `${path} has an unsupported schema or kind`));
    return;
  }
  validateSource(record.source, manifest.source.commit, `${path}.source`, issues);
  if (Array.isArray(record.artifacts)) validateArtifacts(record.artifacts, manifestArtifacts, `${path}.artifacts`, issues);
  const accepted = correctnessPath.split(".").reduce((value, key) => value?.[key], record);
  if (accepted !== true) issues.push(issue("correctness-failed", `${path}.${correctnessPath}`, `${family} was not accepted`));
};

const validateSelfConsistency = (record, manifest, issues) => {
  validateSingleRecord({
    record,
    manifest,
    manifestArtifacts: new Map(),
    issues,
    family: "selfConsistency",
    kind: "lean-bridge-performance-self-consistency",
    correctnessPath: "accepted",
  });
  if (!isObject(record)) return;
  if (!Number.isInteger(record.repetitions) || record.repetitions < 3) {
    issues.push(issue("insufficient-repetitions", "measurements.selfConsistency.repetitions", "CI requires at least three repetitions"));
  }
  if (!isObject(record.timingVariance) || Object.keys(record.timingVariance).length === 0) {
    issues.push(issue("missing-variance", "measurements.selfConsistency.timingVariance", "timing variance is required"));
  }
  if (canonicalizeJsonValue(record.profiles ?? []) !== canonicalizeJsonValue(spatialProfiles)) {
    issues.push(issue("profile-drift", "measurements.selfConsistency.profiles", "self-consistency must cover every composition profile in canonical order"));
  }
  if (!sha256Pattern.test(record.semanticSha256 ?? "")) {
    issues.push(issue("invalid-semantic-hash", "measurements.selfConsistency.semanticSha256", "semanticSha256 must be SHA-256"));
  }
};

const validateBuildReproducibility = (record, manifest, issues) => {
  validateSingleRecord({
    record,
    manifest,
    manifestArtifacts: new Map(),
    issues,
    family: "buildReproducibility",
    kind: "lean-bridge-performance-build-reproducibility",
    correctnessPath: "accepted",
  });
  if (!isObject(record)) return;
  if (!isObject(record.buildA) || !isObject(record.buildB) || !Array.isArray(record.differences)) {
    issues.push(issue("missing-reproducibility-inventory", "measurements.buildReproducibility", "both clean-build inventories and differences are required"));
  }
  if (record.accepted === true && record.differences?.length !== 0) {
    issues.push(issue("reproducibility-contradiction", "measurements.buildReproducibility.differences", "an accepted comparison cannot contain differences"));
  }
  if (
    record.buildA?.sha256 !== record.buildB?.sha256 ||
    record.buildA?.artifactCount !== record.buildB?.artifactCount ||
    record.buildA?.totalBytes !== record.buildB?.totalBytes
  ) {
    issues.push(issue("reproducibility-drift", "measurements.buildReproducibility", "accepted clean-build inventories must have identical identity, count, and bytes"));
  }
};

const validateOverheadMetrics = (record, issues) => {
  if (!isObject(record)) return;
  for (const name of overheadFirstCalls) {
    if (!Number.isFinite(record.firstCallsNs?.[name]) || record.firstCallsNs[name] < 0) {
      issues.push(issue("missing-metric", `measurements.overhead.firstCallsNs.${name}`, `${name} first-call timing is required`));
    }
  }
  for (const name of overheadOperations) validateSummary(record.operations?.[name], `measurements.overhead.operations.${name}`, issues);
  if (!sha256Pattern.test(record.bindingIrSha256 ?? "")) {
    issues.push(issue("invalid-binding-identity", "measurements.overhead.bindingIrSha256", "overhead evidence must identify its Binding IR"));
  }
  if (!isObject(record.cancellation) || !Array.isArray(record.limitations)) {
    issues.push(issue("missing-metrics", "measurements.overhead", "overhead cancellation and limitations are required"));
  }
};

const validateLifecycleMetrics = (record, issues) => {
  if (!isObject(record)) return;
  for (const path of [
    ["memory", "highWater"],
    ["memory", "retained"],
    ["lifecycle", "highWater"],
    ["lifecycle", "retained"],
    ["lifecycle", "delayedFinalization"],
    ["lifecycle", "crossRuntime"],
    ["lifecycle", "shutdownWithLiveOwnership"],
  ]) {
    if (!isObject(path.reduce((value, key) => value?.[key], record))) {
      issues.push(issue("missing-metrics", `measurements.lifecycle.${path.join(".")}`, `${path.join(".")} is required`));
    }
  }
  if (!Array.isArray(record.memory?.samples) || !Array.isArray(record.lifecycle?.rounds) || !Array.isArray(record.limitations)) {
    issues.push(issue("missing-metrics", "measurements.lifecycle", "lifecycle samples, rounds, and limitations are required"));
  }
  if (!sha256Pattern.test(record.bindingIrSha256 ?? "")) {
    issues.push(issue("invalid-binding-identity", "measurements.lifecycle.bindingIrSha256", "lifecycle evidence must identify its Binding IR"));
  }
};

const validateManifest = (manifest, issues) => {
  const required = ["schemaVersion", "kind", "recordedAt", "source", "workflow", "toolchain", "identities", "artifacts", "resource", "limitations"];
  if (!exactKeys(manifest, required, [], "manifest", issues)) return;
  if (manifest.schemaVersion !== 1 || manifest.kind !== "lean-bridge-performance-ci-manifest") {
    issues.push(issue("invalid-schema", "manifest", "manifest has an unsupported schema or kind"));
  }
  if (!isObject(manifest.source) || !commitPattern.test(manifest.source.commit ?? "") || manifest.source.dirty !== false) {
    issues.push(issue("invalid-source", "manifest.source", "manifest must identify a clean committed revision"));
  }
  for (const name of ["workloads", "corpus", "methodology", "graphLock", "packageLock", "flakeLock", "bootstrap"]) {
    const identity = manifest.identities?.[name];
    if (!isObject(identity) || typeof identity.path !== "string" || !sha256Pattern.test(identity.sha256 ?? "")) {
      issues.push(issue("invalid-identity", `manifest.identities.${name}`, `${name} identity is required`));
    }
  }
  if (!sha256Pattern.test(manifest.identities?.workloads?.semanticSha256 ?? "")) {
    issues.push(issue("invalid-identity", "manifest.identities.workloads.semanticSha256", "the workload semantic identity is required"));
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    issues.push(issue("missing-artifacts", "manifest.artifacts", "build manifest must contain artifacts"));
  }
  const artifactPaths = new Set();
  for (const [index, artifact] of (manifest.artifacts ?? []).entries()) {
    const path = `manifest.artifacts[${index}]`;
    if (!isObject(artifact) || typeof artifact.path !== "string" || !Number.isInteger(artifact.bytes) || artifact.bytes < 0 || !sha256Pattern.test(artifact.sha256 ?? "")) {
      issues.push(issue("invalid-artifact", path, `${path} must contain a path, exact bytes, and SHA-256`));
      continue;
    }
    if (artifactPaths.has(artifact.path)) issues.push(issue("duplicate-artifact", path, `duplicate build artifact ${artifact.path}`));
    artifactPaths.add(artifact.path);
  }
};

const validateJobs = (jobs, measurements, issues) => {
  if (!Array.isArray(jobs)) {
    issues.push(issue("missing-jobs", "jobs", "CI job records are required"));
    return;
  }
  const seen = new Set();
  const expectedRoles = Object.freeze({
    build: ["build-manifest"],
    spatial: ["spatial"],
    scaling: ["scaling"],
    overhead: ["overhead"],
    lifecycle: ["lifecycle"],
    reproducibility: ["selfConsistency", "buildReproducibility"],
  });
  for (const [index, job] of jobs.entries()) {
    const path = `jobs[${index}]`;
    if (!isObject(job) || job.schemaVersion !== 1 || job.kind !== "lean-bridge-performance-ci-job") {
      issues.push(issue("invalid-job", path, `${path} has an unsupported schema or kind`));
      continue;
    }
    if (!performanceCiJobIds.includes(job.id)) issues.push(issue("unknown-job", `${path}.id`, `unsupported job ${job.id}`));
    if (seen.has(job.id)) issues.push(issue("duplicate-job", `${path}.id`, `duplicate job ${job.id}`));
    seen.add(job.id);
    if (job.accepted !== true) issues.push(issue("job-failed", path, `${job.id} did not complete successfully`));
    if (!isObject(job.resources?.before) || !isObject(job.resources?.after)) {
      issues.push(issue("missing-resource-snapshot", `${path}.resources`, `${job.id} must report before and after resources`));
    }
    const resultRoles = new Set();
    for (const result of job.results ?? []) {
      if (resultRoles.has(result.role)) issues.push(issue("duplicate-job-result", `${path}.results`, `${job.id} contains duplicate result role ${result.role}`));
      resultRoles.add(result.role);
      if (!expectedRoles[job.id]?.includes(result.role)) issues.push(issue("misbound-job-result", `${path}.results`, `${job.id} cannot publish ${result.role}`));
      const family = performanceCiFamilies.find(name => measurements[name]?.sha256 === result.sha256);
      if (!family && result.role !== "build-manifest") {
        issues.push(issue("unbound-job-result", `${path}.results`, `${job.id} result ${result.path ?? "unknown"} is not bound to a measurement`));
      }
    }
    if (job.accepted === true) {
      for (const role of expectedRoles[job.id] ?? []) {
        if (!resultRoles.has(role)) issues.push(issue("missing-job-result", `${path}.results`, `${job.id} is missing ${role}`));
      }
    }
  }
  for (const id of performanceCiJobIds) {
    if (!seen.has(id)) issues.push(issue("missing-job", "jobs", `missing CI job record ${id}`));
  }
};

export const assemblePerformanceCiReport = ({ manifest, records, jobs = [], artifact }) => {
  const issues = [];
  validateManifest(manifest, issues);
  const safeManifest = isObject(manifest) ? manifest : {
    source: { commit: null, dirty: null },
    identities: { workloads: {} },
    artifacts: [],
    limitations: [],
  };
  const manifestArtifacts = new Map((safeManifest.artifacts ?? []).map(value => [value.path, value]));
  const measurements = Object.fromEntries(performanceCiFamilies.map(family => {
    const record = records?.[family] ?? null;
    return [family, record === null ? null : Object.freeze({
      sha256: canonicalSha256(record),
      record,
    })];
  }));
  for (const family of performanceCiFamilies) {
    if (measurements[family] === null) issues.push(issue("missing-measurement", `measurements.${family}`, `${family} evidence is required`));
  }
  if (measurements.spatial) validateSpatial(measurements.spatial.record, safeManifest, manifestArtifacts, issues);
  if (measurements.scaling) validateScaling(measurements.scaling.record, safeManifest, manifestArtifacts, issues);
  if (measurements.overhead) validateSingleRecord({
    record: measurements.overhead.record,
    manifest: safeManifest,
    manifestArtifacts,
    issues,
    family: "overhead",
    kind: "lean-bridge-native-overhead-suite",
  });
  if (measurements.overhead) validateOverheadMetrics(measurements.overhead.record, issues);
  if (measurements.lifecycle) validateSingleRecord({
    record: measurements.lifecycle.record,
    manifest: safeManifest,
    manifestArtifacts,
    issues,
    family: "lifecycle",
    kind: "lean-bridge-lifecycle-stability-suite",
  });
  if (measurements.lifecycle) validateLifecycleMetrics(measurements.lifecycle.record, issues);
  if (measurements.selfConsistency) validateSelfConsistency(measurements.selfConsistency.record, safeManifest, issues);
  if (measurements.buildReproducibility) validateBuildReproducibility(measurements.buildReproducibility.record, safeManifest, issues);
  validateJobs(jobs, measurements, issues);

  const accepted = issues.length === 0;
  const report = Object.freeze({
    schemaVersion: 1,
    kind: "lean-bridge-performance-ci-report",
    recordedAt: new Date().toISOString(),
    accepted,
    informational: true,
    source: manifest?.source ?? null,
    workflow: manifest?.workflow ?? null,
    toolchain: manifest?.toolchain ?? null,
    identities: manifest?.identities ?? null,
    build: Object.freeze({
      artifacts: Object.freeze([...(manifest?.artifacts ?? [])]),
      artifactCount: manifest?.artifacts?.length ?? 0,
      totalBytes: (manifest?.artifacts ?? []).reduce((sum, value) => sum + value.bytes, 0),
      sha256: canonicalSha256(manifest?.artifacts ?? []),
    }),
    jobs: Object.freeze([...jobs]),
    measurements: Object.freeze(measurements),
    validation: Object.freeze({ accepted, issueCount: issues.length, issues: Object.freeze(issues) }),
    policy: Object.freeze({
      status: "informational-no-approved-budget",
      budget: null,
      regressionFailureAuthorized: false,
    }),
    artifact: Object.freeze({
      name: artifact?.name ?? "performance-evidence",
      retentionDays: artifact?.retentionDays ?? 30,
      url: artifact?.url ?? null,
    }),
    limitations: Object.freeze([
      ...(manifest?.limitations ?? []),
      "Shared GitHub-hosted runners are not eligible to establish or promote performance budgets.",
      "CI timing measurements remain informational until a versioned performance budget authorizes regression failures.",
      "Toolchain cache bytes are uncompressed workspace bytes, not GitHub's internal compressed cache storage.",
    ]),
  });
  return report;
};

const escapeCell = value => String(value ?? "unavailable")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("|", "\\|")
  .replaceAll("\r", "")
  .replaceAll("\n", "<br>");

const table = (headers, rows) => {
  const line = values => `| ${values.map(escapeCell).join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
};

const number = value => Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value) : "unavailable";
const integer = value => Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value) : "unavailable";
const bytes = value => Number.isFinite(value) ? `${integer(value)} B` : "unavailable";
const nanoseconds = value => Number.isFinite(value) ? `${number(value)} ns` : "unavailable";
const percent = value => Number.isFinite(value) ? `${number(value * 100)}%` : "unavailable";
const status = value => value === true ? "PASS" : value === false ? "FAIL" : "UNAVAILABLE";
const sum = values => values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
const max = values => values.filter(Number.isFinite).reduce((value, candidate) => Math.max(value, candidate), Number.NEGATIVE_INFINITY);

const renderSpatial = record => {
  if (!record) return "Spatial evidence is unavailable.";
  return table(
    ["Profile", "Runtimes", "Factory", "Library load", "Construction", "Initial Wasm", "Final Wasm", "RSS delta", "Correctness"],
    record.runs.map(run => [
      run.profile,
      run.composition?.runtimeInstances,
      nanoseconds(sum(run.composition?.moduleFactoryNs ?? [])),
      nanoseconds(sum(Object.values(run.composition?.libraryLoadNs ?? {}))),
      nanoseconds(run.timing?.constructionNs),
      bytes(run.memory?.initialWasmBytes),
      bytes(run.memory?.finalWasmBytes),
      bytes(Number.isFinite(run.memory?.processRssAfter) && Number.isFinite(run.memory?.processRssBefore)
        ? run.memory.processRssAfter - run.memory.processRssBefore
        : null),
      status(run.correctness?.accepted),
    ]),
  );
};

const renderScaling = record => {
  if (!record) return "Scaling evidence is unavailable.";
  return table(
    ["Libraries", "Profile", "Artifacts", "Bytes", "Import median", "Factory median", "Load median", "First call median", "Peak Wasm", "Peak RSS", "Correctness"],
    record.runs.map(run => {
      const snapshots = run.memory?.phaseSnapshots ?? [];
      return [
        run.graph?.libraryCount,
        run.profile,
        run.bytes?.artifactCount,
        bytes(run.bytes?.totalBytes),
        nanoseconds(run.phases?.moduleImport?.medianNs),
        nanoseconds(run.phases?.moduleFactory?.medianNs),
        nanoseconds(run.phases?.libraryLoad?.medianNs),
        nanoseconds(run.phases?.firstNativeCall?.medianNs),
        bytes(max(snapshots.map(value => value.wasmMemoryBytes))),
        bytes(max(snapshots.map(value => value.process?.rssBytes))),
        status(run.correctness?.accepted),
      ];
    }),
  );
};

const renderOverhead = record => {
  if (!record) return "Native overhead evidence is unavailable.";
  const rows = [];
  for (const [name, value] of Object.entries(record.firstCallsNs ?? {})) {
    rows.push([`first:${name}`, 1, nanoseconds(value), nanoseconds(value)]);
  }
  for (const [name, value] of Object.entries(record.operations ?? {})) {
    rows.push([name, value?.samples ?? "unavailable", nanoseconds(value?.medianNs), nanoseconds(value?.p95Ns)]);
  }
  return table(["Operation", "Samples", "Median", "p95"], rows);
};

const renderLifecycle = record => {
  if (!record) return "Lifecycle evidence is unavailable.";
  const rows = [];
  for (const [name, value] of Object.entries(record.lifecycle?.highWater ?? {})) rows.push([name, value, record.lifecycle?.retained?.[name] ?? "unavailable"]);
  for (const [name, value] of Object.entries(record.memory?.highWater?.process ?? {})) rows.push([`process.${name}`, bytes(value), bytes(record.memory?.retained?.process?.[name])]);
  rows.push(["wasmMemoryBytes", bytes(record.memory?.highWater?.wasmMemoryBytes), bytes(record.memory?.retained?.wasmMemoryBytes)]);
  return table(["Resource", "High water", "Retained"], rows);
};

const renderParity = record => {
  if (!record) return "Composition parity evidence is unavailable.";
  return table(
    ["Profile", "Runtime count", "Result SHA-256", "Checked operations", "Shutdown", "State"],
    record.runs.map(run => [
      run.profile,
      run.composition?.runtimeInstances,
      run.correctness?.resultSha256,
      run.correctness?.checkedOperations,
      (run.composition?.shutdown ?? []).every(Boolean) ? "complete" : "incomplete",
      status(run.correctness?.accepted),
    ]),
  );
};

const renderConsistency = record => {
  if (!record) return "Self-consistency evidence is unavailable.";
  return table(
    ["Metric", "Samples", "Median", "Standard deviation", "CV", "Spread"],
    Object.entries(record.timingVariance ?? {}).map(([name, value]) => [
      name,
      value.repetitions,
      nanoseconds(value.medianNs),
      nanoseconds(value.standardDeviationNs),
      percent(value.coefficientOfVariation),
      number(value.spreadRatio),
    ]),
  );
};

const renderReproducibility = record => {
  if (!record) return "Build reproducibility evidence is unavailable.";
  return table(
    ["Build", "Artifacts", "Bytes", "Inventory SHA-256", "Differences", "State"],
    [
      ["A", record.buildA?.artifactCount, bytes(record.buildA?.totalBytes), record.buildA?.sha256, record.differences?.length, status(record.accepted)],
      ["B", record.buildB?.artifactCount, bytes(record.buildB?.totalBytes), record.buildB?.sha256, record.differences?.length, status(record.accepted)],
    ],
  );
};

const renderArtifacts = report => {
  const artifacts = new Map();
  for (const family of ["spatial", "scaling", "overhead", "lifecycle"]) {
    const record = report.measurements[family]?.record;
    const lists = Array.isArray(record?.runs) ? record.runs.map(run => run.artifacts ?? []) : [record?.artifacts ?? []];
    for (const value of lists.flat()) artifacts.set(`${value.path}:${value.sha256}`, value);
  }
  return table(
    ["Artifact", "Bytes", "SHA-256"],
    [...artifacts.values()].sort((left, right) => left.path.localeCompare(right.path)).map(value => [value.path, bytes(value.bytes), value.sha256]),
  );
};

const renderJobs = report => table(
  ["Job", "State", "Elapsed", "Cache", "Free disk before", "Free disk after", "Toolchains", "Build", "Evidence"],
  report.jobs.map(job => [
    job.id,
    status(job.accepted),
    Number.isFinite(job.durationMs) ? `${number(job.durationMs / 1000)} s` : "unavailable",
    job.cacheHit === null ? "unavailable" : job.cacheHit ? "hit" : "miss",
    bytes(job.resources?.before?.disk?.availableBytes),
    bytes(job.resources?.after?.disk?.availableBytes),
    bytes(job.resources?.after?.toolchainsBytes),
    bytes(job.resources?.after?.buildBytes),
    bytes(job.resources?.after?.evidenceBytes),
  ]),
);

const renderLimitations = report => {
  const values = new Set(report.limitations ?? []);
  for (const family of performanceCiFamilies) {
    for (const value of report.measurements[family]?.record?.limitations ?? []) values.add(value);
    for (const run of report.measurements[family]?.record?.runs ?? []) {
      for (const value of run.limitations ?? []) values.add(value);
    }
  }
  return [...values].map(value => `- ${escapeCell(value)}`).join("\n") || "- None reported.";
};

export const renderPerformanceCiSummary = report => {
  const spatial = report.measurements.spatial?.record ?? null;
  const scaling = report.measurements.scaling?.record ?? null;
  const overhead = report.measurements.overhead?.record ?? null;
  const lifecycle = report.measurements.lifecycle?.record ?? null;
  const consistency = report.measurements.selfConsistency?.record ?? null;
  const reproducibility = report.measurements.buildReproducibility?.record ?? null;
  const artifactLink = report.artifact.url
    ? `[${escapeCell(report.artifact.name)}](${report.artifact.url})`
    : escapeCell(report.artifact.name);
  const issues = report.validation.issues.length === 0
    ? "No evidence-integrity issues."
    : table(["Code", "Path", "Failure"], report.validation.issues.map(value => [value.code, value.path, value.message]));
  const runnerSeconds = sum(report.jobs.map(job => job.durationMs)) / 1000;
  const starts = report.jobs.map(job => Date.parse(job.resources?.before?.recordedAt)).filter(Number.isFinite);
  const finishes = report.jobs.map(job => Date.parse(job.resources?.after?.recordedAt)).filter(Number.isFinite);
  const workflowSpanSeconds = starts.length > 0 && finishes.length > 0
    ? (Math.max(...finishes) - Math.min(...starts)) / 1000
    : null;

  return [
    "# Lean Bridge performance evidence",
    "",
    table(
      ["Evidence", "Value"],
      [
        ["Integrity", status(report.accepted)],
        ["Performance policy", "Informational. No approved performance budget is installed."],
        ["Source revision", report.source?.commit],
        ["Workflow event", report.workflow?.event],
        ["Runner attempt", report.workflow?.runAttempt],
        ["Evidence artifact", `${artifactLink}, retained ${report.artifact.retentionDays} days`],
        ["Summed runner time", `${number(runnerSeconds)} s`],
        ["Measured workflow span", Number.isFinite(workflowSpanSeconds) ? `${number(workflowSpanSeconds)} s` : "unavailable"],
        ["Build inventory", `${report.build.artifactCount} files, ${bytes(report.build.totalBytes)}, ${report.build.sha256}`],
      ],
    ),
    "",
    "## Startup and composition",
    "",
    renderSpatial(spatial),
    "",
    "## Library scaling",
    "",
    renderScaling(scaling),
    "",
    "## Native calls and marshalling",
    "",
    renderOverhead(overhead),
    "",
    "## Memory and lifecycle",
    "",
    renderLifecycle(lifecycle),
    "",
    "## Cross-profile parity",
    "",
    renderParity(spatial),
    "",
    "## Timing self-consistency",
    "",
    renderConsistency(consistency),
    "",
    "## Clean-build reproducibility",
    "",
    renderReproducibility(reproducibility),
    "",
    "## Measured artifacts",
    "",
    renderArtifacts(report),
    "",
    "## CI resource footprint",
    "",
    renderJobs(report),
    "",
    "## Evidence validation",
    "",
    issues,
    "",
    "## Limitations",
    "",
    renderLimitations(report),
    "",
  ].join("\n");
};
