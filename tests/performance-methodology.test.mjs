/**
 * Tests the performance methodology behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	inspectPerformanceEnvironment,
	performanceMethodologySha256,
	summarizeMeasurementForks,
	validatePerformanceMethodology,
	verifyMethodologyIdentityInputs,
} from "../src/performance/methodology.mjs";

const methodology = JSON.parse(await readFile(
	"poc/performance/methodology.v1.json",
	"utf8",
));

const observationFor = environment => ({
	environmentId: environment.id
	, operatingSystem: { ...environment.operatingSystem }
	, hardware: {
		architecture: environment.hardware.architecture
		, cpuModel: environment.hardware.cpuModel
		, logicalCpuCount: environment.hardware.logicalCpuCount
		, memoryBytes: environment.hardware.minimumMemoryBytes
	}
	, runtimes: { ...environment.runtimes }
	, constraints: {
		exclusiveRunner: environment.constraints.exclusiveRunner
		, cpuGovernor: environment.constraints.cpuGovernor
		, loadAveragePerCpu: environment.constraints.maximumLoadAveragePerCpu / 2
		, swapInputOutputDelta: 0
		, networkDuringTimedRegions: environment.constraints.networkDuringTimedRegions
	}
});

test("the performance methodology and environment report schemas close every object", async () => {
  const methodologySchema = JSON.parse(await readFile(
    "schema/performance-methodology.schema.json",
    "utf8",
  ));
  const reportSchema = JSON.parse(await readFile(
    "schema/performance-environment-report.schema.json",
    "utf8",
  ));
  assert.equal(methodologySchema.additionalProperties, false);
  assert.equal(methodologySchema.properties.schemaVersion.const, 1);
  assert.equal(methodologySchema.properties.kind.const, "lean-bridge-performance-methodology");
  for(const name of [
    "environment"
    , "toolchain"
    , "identityInput"
    , "execution"
    , "sampling"
    , "statistics"
    , "memory", "noise", "reporting"
  ]) assert.equal(methodologySchema.$defs[name].additionalProperties, false);
  assert.equal(reportSchema.additionalProperties, false);
  for(const name of [
    "methodology", "source", "identityInput", "observation", "operatingSystem"
    , "hardware", "runtimes", "constraints", "issue"
  ]) assert.equal(reportSchema.$defs[name].additionalProperties, false);
});

test("the methodology validates as a closed baseline collection contract", () => {
  assert.equal(validatePerformanceMethodology(methodology), methodology);
  assert.match(performanceMethodologySha256(methodology), /^[a-f0-9]{64}$/);
  assert.equal(methodology.sampling.validForks, 9);
  assert.equal(methodology.statistics.bootstrapResamples, 10_000);
  assert.equal(methodology.sampling.outlierPolicy, "retain-all-samples-from-valid-forks");
  assert.equal(
    methodology.statistics.regressionRule,
    "require-both-statistical-and-practical-significance",
  );
});

test("unknown methodology fields and weakened fork rules fail closed", () => {
  const unknown = structuredClone(methodology);
  unknown.guess = true;
  assert.throws(
    () => validatePerformanceMethodology(unknown),
    error => error.code === "closed-methodology" && error.details.unknown.includes("guess"),
  );
  const weakened = structuredClone(methodology);
  weakened.sampling.validForks = 2;
  assert.throws(
    () => validatePerformanceMethodology(weakened),
    error => error.code === "invalid-methodology",
  );
});

test("every methodology identity input matches the current source tree", async () => {
  const inputs = await verifyMethodologyIdentityInputs(methodology, ".");
  assert.equal(inputs.length, methodology.identityInputs.length);
  assert.ok(inputs.every(input => input.bytes > 0));
});

test("the pinned reference host can authorize baseline collection", () => {
  const reference = methodology.referenceEnvironments.find(environment => (
    environment.eligibility === "budget-eligible"
  ));
  const result = inspectPerformanceEnvironment(methodology, observationFor(reference));
  assert.equal(result.accepted, true);
  assert.equal(result.baselineEligible, true);
  assert.equal(result.classification, "budget-eligible");
  assert.deepEqual(result.issues, []);
});

test("shared CI remains informational even when its declared constraints match", () => {
  const shared = methodology.referenceEnvironments.find(environment => (
    environment.eligibility === "informational-only"
  ));
  const observation = observationFor(shared);
  observation.operatingSystem = { id: "ubuntu", version: "24.04", kernelRelease: "6.8" };
  observation.hardware.cpuModel = "ephemeral runner CPU";
  observation.constraints.cpuGovernor = "unavailable";
  const result = inspectPerformanceEnvironment(methodology, observation);
  assert.equal(result.accepted, true);
  assert.equal(result.baselineEligible, false);
  assert.equal(result.classification, "informational-only");
});

test("environment drift rejects a reference result instead of creating a new baseline", () => {
  const reference = methodology.referenceEnvironments.find(environment => (
    environment.eligibility === "budget-eligible"
  ));
  const observation = observationFor(reference);
  observation.runtimes.node = "v23.0.0";
  observation.constraints.loadAveragePerCpu = 2;
  const result = inspectPerformanceEnvironment(methodology, observation);
  assert.equal(result.accepted, false);
  assert.equal(result.baselineEligible, false);
  assert.equal(result.classification, "rejected");
  assert.deepEqual(result.issues.map(issue => issue.path), [
    "runtimes.node"
    , "constraints.loadAveragePerCpu"
  ]);
});

test("fork summaries retain raw samples and produce deterministic confidence intervals", () => {
  const forks = Array.from({ length: methodology.sampling.validForks }, (_, index) => ({
    id: `fork-${index + 1}`
    , samplesNs: [100 + index, 110 + index, 120 + index, 130 + index, 1000 + index]
  }));
  const options = {
    methodology
    , metricIdentity: "lazy.box.read"
    , resultIdentity: "example-result"
    , forks
  };
  const first = summarizeMeasurementForks(options);
  const second = summarizeMeasurementForks(options);
  assert.deepEqual(first, second);
  assert.equal(first.validForks, 9);
  assert.equal(first.headline.medianNs, 124);
  assert.equal(first.headline.p95Ns, 1004);
  assert.deepEqual(first.forkSummaries[0].samplesNs, forks[0].samplesNs);
  assert.ok(first.headline.medianConfidenceInterval.lowerNs <= first.headline.medianNs);
  assert.ok(first.headline.medianConfidenceInterval.upperNs >= first.headline.medianNs);
});

test("an incomplete fork set cannot produce a baseline summary", () => {
  assert.throws(
    () => summarizeMeasurementForks({
      methodology
      , metricIdentity: "lazy.box.read"
      , resultIdentity: "example-result"
      , forks: [{ id: "one", samplesNs: [1, 2, 3] }]
    }),
    error => error.code === "insufficient-valid-forks",
  );
});

test("methodology tooling never reaches private bridge dispatch", async () => {
  for(const path of [
    "src/performance/methodology.mjs"
    , "scripts/check-performance-methodology.mjs"
  ]) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(
      source,
      /\bccall\b|\bcwrap\b|_bridge_|generic\s+(?:invoke|dispatch)|numeric handle/i,
    );
  }
});
