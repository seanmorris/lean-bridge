/**
 * Implements the methodology module in the performance subsystem.
 *
 * @file
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const shaPattern = /^[a-f0-9]{64}$/;

/**
 * Reports performance methodology failures with stable machine-readable codes and structured diagnostic context.
 */
export class PerformanceMethodologyError extends Error
{
	/**
   * Initializes the error used to report performance methodology failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "PerformanceMethodologyError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new PerformanceMethodologyError(code, message, details);
};

const closedObject = (value, path, expected) => {
	if(!value || typeof value !== "object" || Array.isArray(value))
	{
		fail("invalid-methodology", `${path} must be an object`);
	}
	const actual = Object.keys(value).sort();
	const fields = [...expected].sort();
	const missing = fields.filter(field => !(field in value));
	const unknown = actual.filter(field => !fields.includes(field));
	if(missing.length > 0 || unknown.length > 0)
	{
		fail("closed-methodology", `${path} has missing or unknown fields`, {
			path
			, missing
			, unknown
		});
	}
};

const nonemptyStrings = (value, path) => {
	if(!Array.isArray(value) || value.length === 0 || value.some(item => (
		typeof item !== "string" || item.length === 0
	))) fail("invalid-methodology", `${path} must contain nonempty strings`);
	if(new Set(value).size !== value.length)
	{
		fail("invalid-methodology", `${path} must not contain duplicates`);
	}
};

const validateEnvironment = (environment, index) => {
	const path = `referenceEnvironments[${index}]`;
	closedObject(environment, path, [
		"id"
		, "eligibility"
		, "operatingSystem"
		, "hardware"
		, "runtimes"
		, "constraints"
		, "limitations"
	]);
	if(typeof environment.id !== "string" || environment.id.length === 0)
	{
		fail("invalid-methodology", `${path}.id must be a nonempty string`);
	}
	if(!new Set(["budget-eligible", "informational-only"]).has(environment.eligibility))
	{
		fail("invalid-methodology", `${path}.eligibility is invalid`);
	}
	closedObject(environment.operatingSystem, `${path}.operatingSystem`, [
		"id", "version", "kernelRelease"
	]);
	closedObject(environment.hardware, `${path}.hardware`, [
		"architecture", "cpuModel", "logicalCpuCount", "minimumMemoryBytes"
	]);
	closedObject(environment.runtimes, `${path}.runtimes`, ["node", "playwright", "browser"]);
	closedObject(environment.constraints, `${path}.constraints`, [
		"exclusiveRunner"
		, "cpuGovernor"
		, "maximumLoadAveragePerCpu"
		, "swapActivity"
		, "networkDuringTimedRegions"
	]);
	if(!Number.isInteger(environment.hardware.logicalCpuCount) || environment.hardware.logicalCpuCount < 1)
	{
		fail("invalid-methodology", `${path}.hardware.logicalCpuCount must be positive`);
	}
	if(!Number.isInteger(environment.hardware.minimumMemoryBytes) || environment.hardware.minimumMemoryBytes < 1)
	{
		fail("invalid-methodology", `${path}.hardware.minimumMemoryBytes must be positive`);
	}
	if(!Number.isFinite(environment.constraints.maximumLoadAveragePerCpu) || (
		environment.constraints.maximumLoadAveragePerCpu <= 0
	)) fail("invalid-methodology", `${path}.constraints.maximumLoadAveragePerCpu must be positive`);
	nonemptyStrings(environment.limitations, `${path}.limitations`);
};

/**
 * Validates performance methodology against its closed contract before it enters the reproducible performance evidence pipeline.
 *
 * @param methodology - Closed performance methodology defining identities, environment policy, sampling, and statistics.
 */
export const validatePerformanceMethodology = methodology => {
	closedObject(methodology, "methodology", [
		"schemaVersion", "kind", "id", "status", "referenceEnvironments", "toolchain"
		, "identityInputs"
		, "execution"
		, "sampling"
		, "statistics"
		, "memory"
		, "noise"
		, "reporting"
	]);
	if(methodology.schemaVersion !== 1 || methodology.kind !== "lean-bridge-performance-methodology")
	{
		fail("unsupported-methodology", "performance methodology version or kind is unsupported");
	}
	if(methodology.status !== "approved-for-baseline-collection")
	{
		fail("unapproved-methodology", "performance methodology is not approved for baseline collection");
	}
	if(!Array.isArray(methodology.referenceEnvironments) || methodology.referenceEnvironments.length < 2)
	{
		fail("invalid-methodology", "referenceEnvironments must contain reference and shared CI profiles");
	}
	methodology.referenceEnvironments.forEach(validateEnvironment);
	const environmentIds = methodology.referenceEnvironments.map(environment => environment.id);
	if(new Set(environmentIds).size !== environmentIds.length)
	{
		fail("invalid-methodology", "reference environment ids must be unique");
	}
	if(!methodology.referenceEnvironments.some(environment => environment.eligibility === "budget-eligible"))
	{
		fail("invalid-methodology", "at least one reference environment must be budget eligible");
	}
	if(!methodology.referenceEnvironments.some(environment => environment.eligibility === "informational-only"))
	{
		fail("invalid-methodology", "at least one shared environment must be informational only");
	}

	closedObject(methodology.toolchain, "toolchain", [
		"leanVersion", "leanCommit", "leanPatchSetSha256", "emscriptenVersion"
		, "emscriptenCommit", "libuvCommit", "nixSystem"
	]);
	if(!shaPattern.test(methodology.toolchain.leanPatchSetSha256))
	{
		fail("invalid-methodology", "toolchain.leanPatchSetSha256 is invalid");
	}
	if(!Array.isArray(methodology.identityInputs) || methodology.identityInputs.length === 0)
	{
		fail("invalid-methodology", "identityInputs must not be empty");
	}
	methodology.identityInputs.forEach((input, index) => {
    closedObject(input, `identityInputs[${index}]`, ["path", "sha256"]);
    if(typeof input.path !== "string" || input.path.length === 0 || !shaPattern.test(input.sha256))
{
      fail("invalid-methodology", `identityInputs[${index}] is invalid`);
}
	});
	if(new Set(methodology.identityInputs.map(input => input.path)).size !== methodology.identityInputs.length)
	{
		fail("invalid-methodology", "identity input paths must be unique");
	}

	closedObject(methodology.execution, "execution", [
		"sourceState"
		, "buildIsolation"
		, "targetProfiles"
		, "artifactBuildTiming"
		, "processModel"
		, "profileOrder", "cacheProfiles", "networkTiming"
	]);
	nonemptyStrings(methodology.execution.targetProfiles, "execution.targetProfiles");
	nonemptyStrings(methodology.execution.cacheProfiles, "execution.cacheProfiles");
	closedObject(methodology.sampling, "sampling", [
		"validForks"
		, "maximumInvalidForks"
		, "warmup"
		, "firstCall"
		, "steadyStateSamples"
		, "scalingSamples", "clockNode", "clockBrowser", "clockUnit", "outlierPolicy"
	]);
	if(!Number.isInteger(methodology.sampling.validForks) || methodology.sampling.validForks < 3)
	{
		fail("invalid-methodology", "sampling.validForks must be at least three");
	}
	if(!Number.isInteger(methodology.sampling.maximumInvalidForks) || (
		methodology.sampling.maximumInvalidForks < 0
	)) fail("invalid-methodology", "sampling.maximumInvalidForks must not be negative");
	if(methodology.sampling.outlierPolicy !== "retain-all-samples-from-valid-forks")
	{
		fail("invalid-methodology", "the methodology must retain all samples from valid forks");
	}

	closedObject(methodology.statistics, "statistics", [
		"headline"
		, "requiredDistribution"
		, "confidenceLevel"
		, "bootstrapResamples"
		, "bootstrapUnit"
		, "bootstrapSeed", "comparisonRule", "regressionRule"
	]);
	nonemptyStrings(methodology.statistics.headline, "statistics.headline");
	nonemptyStrings(methodology.statistics.requiredDistribution, "statistics.requiredDistribution");
	if(!(methodology.statistics.confidenceLevel > 0 && methodology.statistics.confidenceLevel < 1))
	{
		fail("invalid-methodology", "statistics.confidenceLevel must be between zero and one");
	}
	if(!Number.isInteger(methodology.statistics.bootstrapResamples) || (
		methodology.statistics.bootstrapResamples < 1000
	)) fail("invalid-methodology", "statistics.bootstrapResamples must be at least 1000");
	if(methodology.statistics.regressionRule !== "require-both-statistical-and-practical-significance")
	{
		fail("invalid-methodology", "regressions must require statistical and practical significance");
	}

	closedObject(methodology.memory, "memory", [
		"authoritative"
		, "supplemental"
		, "explicitGc"
		, "finalization"
		, "wasmGrowth"
		, "retainedState"
	]);
	nonemptyStrings(methodology.memory.authoritative, "memory.authoritative");
	nonemptyStrings(methodology.memory.supplemental, "memory.supplemental");
	closedObject(methodology.noise, "noise", [
		"observations", "invalidForkPolicy", "retryPolicy", "failurePolicy"
	]);
	nonemptyStrings(methodology.noise.observations, "noise.observations");
	closedObject(methodology.reporting, "reporting", [
		"requiredIdentity", "requiredEvidence", "accessibility", "immutableBundle"
	]);
	nonemptyStrings(methodology.reporting.requiredIdentity, "reporting.requiredIdentity");
	nonemptyStrings(methodology.reporting.requiredEvidence, "reporting.requiredEvidence");
	if(methodology.reporting.immutableBundle !== true)
	{
		fail("invalid-methodology", "reporting.immutableBundle must be true");
	}
	return methodology;
};

/**
 * Computes the stable SHA-256 identity for performance methodology so the reproducible performance evidence pipeline can detect byte drift.
 *
 * @param methodology - Closed performance methodology defining identities, environment policy, sampling, and statistics.
 */
export const performanceMethodologySha256 = methodology => {
	validatePerformanceMethodology(methodology);
	return sha256(canonicalizeJsonValue(methodology));
};

/**
 * Verifies methodology identity inputs against recorded identities and rejects any drift before the reproducible performance evidence pipeline proceeds.
 *
 * @param methodology - Closed performance methodology defining identities, environment policy, sampling, and statistics.
 * @param projectRoot - Filesystem root containing the project.
 */
export const verifyMethodologyIdentityInputs = async (methodology, projectRoot) => {
	validatePerformanceMethodology(methodology);
	const root = resolve(projectRoot);
	const inputs = [];
	for(const expected of methodology.identityInputs)
	{
		const bytes = await readFile(join(root, expected.path));
		const actual = sha256(bytes);
		if(actual !== expected.sha256)
		{
			fail("methodology-input-drift", `${expected.path} no longer matches the methodology`, {
				path: expected.path
				, expectedSha256: expected.sha256
				, actualSha256: actual
			});
		}
		inputs.push(Object.freeze({ ...expected, bytes: bytes.byteLength }));
	}
	return Object.freeze(inputs);
};

const matches = (expected, actual) => expected === "reported-by-runner" || expected === actual;

/**
 * Inspects performance environment and returns the structured evidence required by the reproducible performance evidence pipeline.
 *
 * @param methodology - Closed performance methodology defining identities, environment policy, sampling, and statistics.
 * @param observation - Raw environment observation checked against methodology eligibility requirements.
 */
export const inspectPerformanceEnvironment = (methodology, observation) => {
	validatePerformanceMethodology(methodology);
	closedObject(observation, "observation", [
		"environmentId", "operatingSystem", "hardware", "runtimes", "constraints"
	]);
	closedObject(observation.operatingSystem, "observation.operatingSystem", [
		"id", "version", "kernelRelease"
	]);
	closedObject(observation.hardware, "observation.hardware", [
		"architecture", "cpuModel", "logicalCpuCount", "memoryBytes"
	]);
	closedObject(observation.runtimes, "observation.runtimes", ["node", "playwright", "browser"]);
	closedObject(observation.constraints, "observation.constraints", [
		"exclusiveRunner"
		, "cpuGovernor"
		, "loadAveragePerCpu"
		, "swapInputOutputDelta"
		, "networkDuringTimedRegions"
	]);
	const environment = methodology.referenceEnvironments.find(candidate => (
		candidate.id === observation.environmentId
	));
	if(!environment) fail("unknown-performance-environment", `unknown environment ${observation.environmentId}`);
	const issues = [];
	const expect = (path, expected, actual) => {
		if(!matches(expected, actual)) issues.push(Object.freeze({ path, expected, actual }));
	};
	expect("operatingSystem.id", environment.operatingSystem.id, observation.operatingSystem.id);
	expect("operatingSystem.version", environment.operatingSystem.version, observation.operatingSystem.version);
	expect("operatingSystem.kernelRelease", environment.operatingSystem.kernelRelease, observation.operatingSystem.kernelRelease);
	expect("hardware.architecture", environment.hardware.architecture, observation.hardware.architecture);
	expect("hardware.cpuModel", environment.hardware.cpuModel, observation.hardware.cpuModel);
	if(environment.eligibility === "budget-eligible")
	{
		expect("hardware.logicalCpuCount", environment.hardware.logicalCpuCount, observation.hardware.logicalCpuCount);
	}
	if(observation.hardware.memoryBytes < environment.hardware.minimumMemoryBytes)
	{
		issues.push(Object.freeze({
			path: "hardware.memoryBytes"
			, expected: `>=${environment.hardware.minimumMemoryBytes}`
			, actual: observation.hardware.memoryBytes
		}));
	}
	for(const [name, expected] of Object.entries(environment.runtimes))
	{
		expect(`runtimes.${name}`, expected, observation.runtimes[name]);
	}
	if(environment.constraints.exclusiveRunner && !observation.constraints.exclusiveRunner)
	{
		issues.push(Object.freeze({ path: "constraints.exclusiveRunner", expected: true, actual: false }));
	}
	expect("constraints.cpuGovernor", environment.constraints.cpuGovernor, observation.constraints.cpuGovernor);
	if(observation.constraints.loadAveragePerCpu > environment.constraints.maximumLoadAveragePerCpu)
	{
		issues.push(Object.freeze({
			path: "constraints.loadAveragePerCpu"
			, expected: `<=${environment.constraints.maximumLoadAveragePerCpu}`
			, actual: observation.constraints.loadAveragePerCpu
		}));
	}
	if(environment.constraints.swapActivity === "zero-delta" && (
		observation.constraints.swapInputOutputDelta !== 0
	)) issues.push(Object.freeze({
		path: "constraints.swapInputOutputDelta"
		, expected: 0
		, actual: observation.constraints.swapInputOutputDelta
	}));
	expect(
		"constraints.networkDuringTimedRegions",
		environment.constraints.networkDuringTimedRegions,
		observation.constraints.networkDuringTimedRegions,
	);
	const accepted = issues.length === 0;
	const baselineEligible = accepted && environment.eligibility === "budget-eligible";
	return Object.freeze({
		accepted
		, classification: !accepted
			? "rejected"
			: baselineEligible ? "budget-eligible" : "informational-only"
		, baselineEligible
		, environment: Object.freeze({
			id: environment.id
			, eligibility: environment.eligibility
		})
		, issues: Object.freeze(issues)
		, limitations: Object.freeze([...environment.limitations])
	});
};

const percentile = (values, probability) => {
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * probability) - 1)];
};

const medianAbsoluteDeviation = values => {
	const median = percentile(values, 0.5);
	return percentile(values.map(value => Math.abs(value - median)), 0.5);
};

const randomFromSeed = seed => {
	const digest = createHash("sha256").update(seed).digest();
	let state = digest.readUInt32LE(0) || 0x9e3779b9;
	return () => {
		state += 0x6d2b79f5;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
};

const bootstrapMedianInterval = ({ values, confidenceLevel, repetitions, seed }) => {
	const random = randomFromSeed(seed);
	const estimates = [];
	for(let repetition = 0; repetition < repetitions; repetition += 1)
	{
		const sample = [];
		for(let index = 0; index < values.length; index += 1)
		{
			sample.push(values[Math.floor(random() * values.length)]);
		}
		estimates.push(percentile(sample, 0.5));
	}
	const tail = (1 - confidenceLevel) / 2;
	return Object.freeze({
		level: confidenceLevel
		, lowerNs: percentile(estimates, tail)
		, upperNs: percentile(estimates, 1 - tail)
	});
};

/**
 * Validates independent measurement forks and computes deterministic per-fork statistics plus bootstrap confidence intervals.
 *
 * @param root0 - Inputs that bind raw fork samples to one methodology, metric, and result identity.
 * @param root0.methodology - Validated methodology defining fork counts, confidence level, and bootstrap resamples.
 * @param root0.metricIdentity - Stable identifier for the metric summarized across forks.
 * @param root0.resultIdentity - Stable result identifier used to seed deterministic bootstrap sampling.
 * @param root0.forks - Independent fork records containing unique identifiers and raw nanosecond samples.
 */
export const summarizeMeasurementForks = ({ methodology, metricIdentity, resultIdentity, forks }) => {
	validatePerformanceMethodology(methodology);
	if(!Array.isArray(forks) || forks.length < methodology.sampling.validForks)
	{
		fail("insufficient-valid-forks", "the metric does not contain enough valid forks", {
			expected: methodology.sampling.validForks
			, actual: forks?.length ?? null
		});
	}
	const ids = new Set();
	const summaries = forks.map((fork, index) => {
    closedObject(fork, `forks[${index}]`, ["id", "samplesNs"]);
    if(typeof fork.id !== "string" || fork.id.length === 0 || ids.has(fork.id))
{
      fail("invalid-fork", `forks[${index}].id must be unique`);
}
    ids.add(fork.id);
    if(!Array.isArray(fork.samplesNs) || fork.samplesNs.length === 0 || fork.samplesNs.some(value => (
      !Number.isFinite(value) || value < 0
    ))) fail("invalid-fork", `forks[${index}].samplesNs must contain nonnegative numbers`);
    return Object.freeze({
      id: fork.id
      , samples: fork.samplesNs.length
      , minimumNs: Math.min(...fork.samplesNs)
      , medianNs: percentile(fork.samplesNs, 0.5)
      , p95Ns: percentile(fork.samplesNs, 0.95)
      , maximumNs: Math.max(...fork.samplesNs)
      , medianAbsoluteDeviationNs: medianAbsoluteDeviation(fork.samplesNs)
      , samplesNs: Object.freeze([...fork.samplesNs])
    });
	});
	const seedPrefix = [
		performanceMethodologySha256(methodology)
		, resultIdentity
		, metricIdentity
	].join(":");
	const medianValues = summaries.map(summary => summary.medianNs);
	const p95Values = summaries.map(summary => summary.p95Ns);
	return Object.freeze({
		metricIdentity
		, resultIdentity
		, validForks: summaries.length
		, forkSummaries: Object.freeze(summaries)
		, headline: Object.freeze({
			medianNs: percentile(medianValues, 0.5)
			, p95Ns: percentile(p95Values, 0.5)
			, medianConfidenceInterval: bootstrapMedianInterval({
				values: medianValues
				, confidenceLevel: methodology.statistics.confidenceLevel
				, repetitions: methodology.statistics.bootstrapResamples
				, seed: `${seedPrefix}:median`
			})
			, p95ConfidenceInterval: bootstrapMedianInterval({
				values: p95Values
				, confidenceLevel: methodology.statistics.confidenceLevel
				, repetitions: methodology.statistics.bootstrapResamples
				, seed: `${seedPrefix}:p95`
			})
		})
	});
};

const readOptional = async path => {
	try
	{
		return (await readFile(path, "utf8")).trim();
	} catch
	{
		return "unavailable";
	}
};

const osRelease = async () => {
	const contents = await readFile("/etc/os-release", "utf8");
	const entries = contents
		.split("\n")
		.filter(line => line.includes("="))
		.map(line => {
			const separator = line.indexOf("=");
			return [line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, "")];
		});
	return Object.fromEntries(entries);
};

/**
 * Collects performance environment observation in deterministic order so the reproducible performance evidence pipeline can compare exact evidence.
 *
 * @param root0 - Named inputs and dependency overrides used to collect performance environment observation.
 * @param root0.projectRoot - Filesystem root containing the project.
 * @param root0.environmentId - Stable identifier for the environment.
 * @param root0.exclusiveRunner - Injected probe runner used for commands that require exclusive host access.
 * @param root0.networkDisabled - Whether the observation confirmed that benchmark execution had no network access.
 * @param root0.swapInputOutputDelta - Observed swap change used to reject memory-pressure-contaminated benchmark runs.
 */
export const collectPerformanceEnvironmentObservation = async ({
	projectRoot
	, environmentId
	, exclusiveRunner = false
	, networkDisabled = false
	, swapInputOutputDelta = 0
} = {}) => {
	const root = resolve(projectRoot ?? ".");
	const release = await osRelease();
	const playwrightPackage = JSON.parse(await readFile(join(root, "node_modules/playwright/package.json"), "utf8"));
	const browserExecutable = execFileSync(process.execPath, [
		"-e"
		, "import('playwright').then(({chromium})=>process.stdout.write(chromium.executablePath()))"
	], { cwd: root, encoding: "utf8" });
	const browser = execFileSync(browserExecutable, ["--version"], { encoding: "utf8" }).trim();
	const cpus = os.cpus();
	return Object.freeze({
		environmentId
		, operatingSystem: Object.freeze({
			id: release.ID
			, version: release.VERSION_ID
			, kernelRelease: os.release()
		})
		, hardware: Object.freeze({
			architecture: os.arch()
			, cpuModel: cpus[0]?.model ?? "unknown"
			, logicalCpuCount: cpus.length
			, memoryBytes: os.totalmem()
		})
		, runtimes: Object.freeze({
			node: process.version
			, playwright: playwrightPackage.version
			, browser
		})
		, constraints: Object.freeze({
			exclusiveRunner
			, cpuGovernor: await readOptional("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor")
			, loadAveragePerCpu: os.loadavg()[0] / cpus.length
			, swapInputOutputDelta
			, networkDuringTimedRegions: networkDisabled ? "disabled" : "enabled"
		})
	});
};
