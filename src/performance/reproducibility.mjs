import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const portable = path => path.replaceAll("\\", "/");
const roots = Object.freeze([
	"poc/performance"
	, "schema/performance-corpus.schema.json"
	, "schema/performance-workloads.schema.json"
	, "schema/performance-result.schema.json"
	, "schema/performance-scaling-result.schema.json"
	, "schema/performance-overhead-result.schema.json"
	, "schema/performance-lifecycle-result.schema.json"
	, "build/performance-wasm"
	, "build/performance-scale"
]);

const isGeneratedMeasurement = path => (
	path === "build/performance-wasm/interactive-suite.json"
  || path === "build/performance-wasm/self-consistency-suite.json"
  || /^build\/performance-scale\/scaling-suite(?:-[^/]*)?\.json$/.test(path)
);

const isTransientBuildProduct = path => (
	path.endsWith(".o")
  || path.endsWith(".olean")
  || path.endsWith(".link.map")
);

const walk = async (root, path, output) => {
	const value = await stat(path);
	if(value.isDirectory())
	{
		const entries = await readdir(path);
		for(const entry of entries.sort()) await walk(root, join(path, entry), output);
		return;
	}
	if(!value.isFile()) throw new Error(`unsupported benchmark artifact ${path}`);
	const portablePath = portable(relative(root, path));
	if(isGeneratedMeasurement(portablePath) || isTransientBuildProduct(portablePath)) return;
	const bytes = await readFile(path);
	output.push(Object.freeze({
		path: portablePath
		, bytes: bytes.byteLength
		, sha256: sha256(bytes)
	}));
};

/**
 * Collects performance inventory in deterministic order so the reproducible performance evidence pipeline can compare exact evidence.
 *
 * @param projectRoot - Filesystem root containing the project.
 */
export const collectPerformanceInventory = async projectRoot => {
	const root = resolve(projectRoot);
	const entries = [];
	for(const path of roots) await walk(root, join(root, path), entries);
	entries.sort((left, right) => left.path.localeCompare(right.path));
	return Object.freeze({
		entries: Object.freeze(entries)
		, artifactCount: entries.length
		, totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0)
		, sha256: sha256(canonicalizeJsonValue(entries))
		, scope: Object.freeze({
			included: Object.freeze([
				"benchmark sources and locked schemas"
				, "generated source and public bindings"
				, "executable Wasm and JavaScript artifacts"
				, "normalized audit manifests"
			])
			, excluded: Object.freeze([
				"timing measurement records"
				, "compiler and linker intermediates"
				, "raw linker maps containing build-root paths"
			])
		})
	});
};

/**
 * Compares performance inventories and returns bounded diagnostics for every material difference.
 *
 * @param buildA - First build inventory used as one side of the reproducibility comparison.
 * @param buildB - Second build inventory used as the other side of the reproducibility comparison.
 */
export const comparePerformanceInventories = (buildA, buildB) => {
	const left = new Map(buildA.entries.map(entry => [entry.path, entry]));
	const right = new Map(buildB.entries.map(entry => [entry.path, entry]));
	const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
	const differences = paths.flatMap(path => {
    const a = left.get(path);
    const b = right.get(path);
    if(a?.sha256 === b?.sha256 && a?.bytes === b?.bytes) return [];
    return [Object.freeze({
      path
      , kind: !a ? "missing-from-build-a" : !b ? "missing-from-build-b" : "content-drift"
      , buildA: a ?? null
      , buildB: b ?? null
    })];
	});
	return Object.freeze({
		accepted: differences.length === 0
		, buildA
		, buildB
		, differences: Object.freeze(differences)
	});
};

const semanticRecord = suite => Object.freeze({
	schemaVersion: suite.schemaVersion
	, kind: suite.kind
	, runs: Object.freeze(suite.runs.map(run => Object.freeze({
		schemaVersion: run.schemaVersion
		, kind: run.kind
		, profile: run.profile
		, workload: run.workload
		, artifacts: run.artifacts
		, runtimeInstances: run.composition.runtimeInstances
		, correctness: run.correctness
		, operationNames: Object.freeze(Object.keys(run.timing.operations).sort())
		, shutdown: run.composition.shutdown
		, initialWasmBytes: run.memory.initialWasmBytes
		, finalWasmBytes: run.memory.finalWasmBytes
	})))
});

const timingMetrics = suite => {
	const values = new Map();
	const push = (name, value) => {
		if(!Number.isFinite(value) || value < 0) throw new Error(`invalid timing metric ${name}`);
		values.set(name, value);
	};
	for(const run of suite.runs)
	{
		const prefix = run.profile;
		run.composition.moduleFactoryNs.forEach((value, index) => (
			push(`${prefix}.moduleFactory.${index}`, value)
		));
		for(const [name, value] of Object.entries(run.composition.libraryLoadNs))
		{
			push(`${prefix}.libraryLoad.${name}`, value);
		}
		push(`${prefix}.construction`, run.timing.constructionNs);
		for(const [name, summary] of Object.entries(run.timing.operations))
		{
			push(`${prefix}.operation.${name}.median`, summary.medianNs);
			push(`${prefix}.operation.${name}.p95`, summary.p95Ns);
		}
	}
	return values;
};

const summarizeVariance = values => {
	const sorted = [...values].sort((left, right) => left - right);
	const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
	const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
	const standardDeviationNs = Math.sqrt(variance);
	return Object.freeze({
		repetitions: values.length
		, valuesNs: Object.freeze([...values])
		, minimumNs: sorted[0]
		, medianNs: sorted[Math.ceil(sorted.length / 2) - 1]
		, maximumNs: sorted.at(-1)
		, meanNs: mean
		, standardDeviationNs
		, coefficientOfVariation: mean === 0 ? 0 : standardDeviationNs / mean
		, spreadRatio: sorted[0] === 0 ? null : sorted.at(-1) / sorted[0]
	});
};

/**
 * Verifies repeated benchmark suites produce identical semantics and metric sets, then summarizes timing variance for every metric.
 *
 * @param suites - Two or more benchmark suite results collected from the same fixed workloads.
 */
export const analyzePerformanceSelfConsistency = suites => {
	if(!Array.isArray(suites) || suites.length < 2)
	{
		throw new TypeError("performance self-consistency requires at least two repetitions");
	}
	const semanticRecords = suites.map(semanticRecord);
	const semanticHashes = semanticRecords.map(record => sha256(canonicalizeJsonValue(record)));
	const uniqueSemanticHashes = [...new Set(semanticHashes)];
	if(uniqueSemanticHashes.length !== 1)
	{
		const error = new Error("fixed performance workloads produced semantic drift");
		error.code = "benchmark-semantic-drift";
		error.semanticHashes = semanticHashes;
		throw error;
	}
	const repetitions = suites.map(timingMetrics);
	const expectedNames = [...repetitions[0].keys()].sort();
	for(const values of repetitions.slice(1))
	{
		const names = [...values.keys()].sort();
		if(canonicalizeJsonValue(names) !== canonicalizeJsonValue(expectedNames))
		{
			const error = new Error("performance repetitions reported different timing metrics");
			error.code = "benchmark-metric-drift";
			throw error;
		}
	}
	return Object.freeze({
		accepted: true
		, repetitions: suites.length
		, semanticSha256: uniqueSemanticHashes[0]
		, semanticHashes: Object.freeze(semanticHashes)
		, timingVariance: Object.freeze(Object.fromEntries(expectedNames.map(name => [
			name
			, summarizeVariance(repetitions.map(values => values.get(name)))
		])))
	});
};

export const performanceInventoryRoots = roots;
