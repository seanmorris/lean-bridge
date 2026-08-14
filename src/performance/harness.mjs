/**
 * Implements the harness module in the performance subsystem.
 *
 * @file
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";
import { hashPerformanceWorkloadManifest, materializePerformanceWorkload } from "./workloads.mjs";

const projectRoot = new URL("../../", import.meta.url);
const componentIds = Object.freeze([
	"performance/ordered-search@1.0.0"
	, "performance/spatial-index@1.0.0"
	, "performance/spatial-consumer@1.0.0"
]);
const profileDefinitions = Object.freeze({
	lazy: Object.freeze({ main: "build/performance-wasm/main.mjs", prelinked: false, runtimeInstances: 1 })
	, startup: Object.freeze({ main: "build/performance-wasm/startup/main.mjs", prelinked: true, runtimeInstances: 1 })
	, "final-static": Object.freeze({ main: "build/performance-wasm/final-static/main.mjs", prelinked: true, runtimeInstances: 1 })
	, islands: Object.freeze({ main: "build/performance-wasm/main.mjs", prelinked: false, runtimeInstances: 3 })
});

/**
 * Reports performance harness failures with stable machine-readable codes and structured diagnostic context.
 */
export class PerformanceHarnessError extends Error
{
	/**
   * Initializes the error used to report performance harness failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "PerformanceHarnessError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new PerformanceHarnessError(code, message, details);
};

const nanoseconds = milliseconds => Math.round(milliseconds * 1_000_000);

const timed = async operation => {
	const started = performance.now();
	const value = await operation();
	return { value, durationNs: nanoseconds(performance.now() - started) };
};

const timedSync = operation => {
	const started = performance.now();
	const value = operation();
	return { value, durationNs: nanoseconds(performance.now() - started) };
};

const percentile = (sorted, probability) => {
	if(sorted.length === 0) return null;
	return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * probability) - 1)];
};

const summarize = samples => {
	const sorted = [...samples].sort((left, right) => left - right);
	return Object.freeze({
		samples: sorted.length
		, samplesNs: Object.freeze([...samples])
		, minimumNs: sorted[0] ?? null
		, medianNs: percentile(sorted, 0.5)
		, p95Ns: percentile(sorted, 0.95)
		, maximumNs: sorted.at(-1) ?? null
		, totalNs: sorted.reduce((sum, value) => sum + value, 0)
	});
};

const compareCoordinates = (left, right) => {
	for(let index = 0; index < left.length; index += 1)
	{
		if(left[index] < right[index]) return -1;
		if(left[index] > right[index]) return 1;
	}
	return 0;
};

const comparePoints = (left, right) =>
	compareCoordinates(left.coordinates, right.coordinates) || left.id - right.id;

const normalizeResult = (call, value) => {
	if(call === "build" || call === "insert") return { size: value };
	if(call === "lowerBound") return { index: value };
	if(call === "nearest")
	{
		return {
			pointId: value.pointId
			, coordinates: [...value.coordinates]
			, squaredDistance: Number(value.squaredDistance)
		};
	}
	if(call === "range") return { pointIds: [...value] };
	if(call === "consumerRangeChecksum")
	{
		return { pointIds: [...value.pointIds], checksum: Number(value.checksum) };
	}
	if(call === "dispose") return { released: value };
	throw new Error(`unknown result shape ${call}`);
};

const assertExpected = (step, actual, expected) => {
	const actualBytes = canonicalizeJsonValue(actual);
	const expectedBytes = canonicalizeJsonValue(expected.result);
	if(actualBytes !== expectedBytes)
	{
		fail("incorrect-result", `${step.call} returned an unexpected result at operation ${step.sequence}`, {
			sequence: step.sequence
			, call: step.call
			, expected: expected.result
			, actual
		});
	}
};

const loadFactory = async profile => {
	const definition = profileDefinitions[profile];
	if(!definition) fail("unknown-profile", `unknown performance profile ${profile}`);
	const imported = await import(new URL(definition.main, projectRoot));
	return { definition, factory: imported.default };
};

const loadBindings = async () => import(new URL(
	"build/performance-wasm/bindings.mjs",
	projectRoot,
));

const instantiateRuntime = async (factory, createLibraries, prelinked) => {
	const created = await timed(() => factory());
	const libraries = createLibraries(
		created.value,
		prelinked ? { prelinked: componentIds } : undefined,
	);
	return {
		module: created.value
		, libraries
		, moduleFactoryNs: created.durationNs
		, initialWasmMemoryBytes: created.value.HEAPU32.buffer.byteLength
	};
};

const loadSurface = async (runtime, requests) => {
	const timings = {};
	const surfaces = {};
	for(const request of requests)
	{
		const loaded = await timed(() => runtime.libraries.load(request));
		timings[request] = loaded.durationNs;
		surfaces[request] = loaded.value;
	}
	return { timings, surfaces };
};

const sha256File = async path => {
	const bytes = await readFile(new URL(path, projectRoot));
	return Object.freeze({
		path
		, bytes: bytes.byteLength
		, sha256: createHash("sha256").update(bytes).digest("hex")
	});
};

const artifactsFor = async profile => {
	const main = profileDefinitions[profile].main.replace(/\.mjs$/, ".wasm");
	const paths = profile === "final-static"
		? [main]
		: [
			main
			, "build/performance-wasm/ordered-search.so.wasm"
			, "build/performance-wasm/spatial-index.so.wasm"
			, "build/performance-wasm/spatial-consumer.so.wasm"
		];
	return Promise.all(paths.map(sha256File));
};

const currentRevision = () => {
	try
	{
		const commit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: new URL(projectRoot).pathname
			, encoding: "utf8"
		}).trim();
		const dirty = execFileSync("git", ["status", "--porcelain"], {
			cwd: new URL(projectRoot).pathname
			, encoding: "utf8"
		}).trim().length > 0;
		return { commit, dirty };
	} catch
	{
		return { commit: null, dirty: null };
	}
};

const runTrace = ({ materialized, ordered, spatial, consumer }) => {
	const operationSamples = new Map();
	const firstCallsNs = {};
	const hostPoints = materialized.initialPoints.map(point => ({
		id: point.id
		, coordinates: [...point.coordinates]
	}));
	let index;
	let constructionNs = null;

	for(const step of materialized.trace)
	{
		const expected = materialized.expectedResults[step.sequence];
		let invoked;
		if(step.call === "build")
		{
			invoked = timedSync(() => {
        index = new spatial.SpatialIndex(materialized.identity.workload.dimensions, hostPoints);
        return index.size;
			});
			constructionNs = invoked.durationNs;
		} else if(step.call === "lowerBound")
		{
			invoked = timedSync(() => ordered.lowerBound(hostPoints, step.arguments.query));
		} else if(step.call === "nearest")
		{
			invoked = timedSync(() => index.nearest(step.arguments.query));
		} else if(step.call === "range")
		{
			invoked = timedSync(() => index.range(step.arguments.minimum, step.arguments.maximum));
		} else if(step.call === "insert")
		{
			invoked = timedSync(() => index.insert(step.arguments.point));
			hostPoints.push({
				id: step.arguments.point.id
				, coordinates: [...step.arguments.point.coordinates]
			});
			hostPoints.sort(comparePoints);
		} else if(step.call === "consumerRangeChecksum")
		{
			invoked = timedSync(() => consumer.rangeChecksum(
				index,
				step.arguments.minimum,
				step.arguments.maximum,
			));
		} else if(step.call === "dispose")
		{
			invoked = timedSync(() => index.dispose());
		} else
		{
			fail("unknown-operation", `unknown trace operation ${step.call}`);
		}

		const actual = normalizeResult(step.call, invoked.value);
		assertExpected(step, actual, expected);
		if(!(step.call in firstCallsNs)) firstCallsNs[step.call] = invoked.durationNs;
		if(step.phase === "measure")
		{
			if(!operationSamples.has(step.call)) operationSamples.set(step.call, []);
			operationSamples.get(step.call).push(invoked.durationNs);
		}
	}

	return {
		constructionNs
		, firstCallsNs: Object.freeze(firstCallsNs)
		, operations: Object.freeze(Object.fromEntries(
			[...operationSamples].map(([name, samples]) => [name, summarize(samples)]),
		))
	};
};

/**
 * Runs performance profile and returns a structured result suitable for the reproducible performance evidence pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to run performance profile.
 * @param root0.manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 * @param root0.workload - Validated workload definition executed under the selected runtime profile.
 * @param root0.profile - Named runtime, graph, transport, or measurement profile selecting the closed behavior to execute.
 */
export const runPerformanceProfile = async ({ manifest, workload: requested, profile }) => {
	const materialized = materializePerformanceWorkload(manifest, requested);
	const { definition, factory } = await loadFactory(profile);
	const { createLibraries } = await loadBindings();
	const processMemoryBefore = process.memoryUsage();
	const runtimes = [];
	for(let index = 0; index < definition.runtimeInstances; index += 1)
	{
		runtimes.push(await instantiateRuntime(factory, createLibraries, definition.prelinked));
	}

	let loadTimings;
	let surfaces;
	if(profile === "islands")
	{
		await loadSurface(runtimes[0], ["ordered-search"]);
		await loadSurface(runtimes[1], ["spatial-index"]);
		const loaded = await loadSurface(
			runtimes[2],
			["ordered-search", "spatial-index", "spatial-consumer"],
		);
		loadTimings = loaded.timings;
		surfaces = loaded.surfaces;
	} else
	{
		const loaded = await loadSurface(
			runtimes[0],
			["ordered-search", "spatial-index", "spatial-consumer"],
		);
		loadTimings = loaded.timings;
		surfaces = loaded.surfaces;
	}

	const trace = runTrace({
		materialized
		, ordered: surfaces["ordered-search"]
		, spatial: surfaces["spatial-index"]
		, consumer: surfaces["spatial-consumer"]
	});
	const diagnosticsBeforeShutdown = runtimes.map(runtime => runtime.libraries.diagnostics());
	if(diagnosticsBeforeShutdown.some(diagnostic => diagnostic.liveResources !== 0))
	{
		fail("resource-leak", `${profile} retained resources after workload cleanup`, {
			diagnostics: diagnosticsBeforeShutdown
		});
	}
	const shutdown = runtimes.map(runtime => runtime.libraries.shutdown());
	if(shutdown.some(value => !value))
	{
		fail("shutdown-failed", `${profile} failed to shut down every runtime`, { shutdown });
	}
	const processMemoryAfter = process.memoryUsage();

	return Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-performance-profile"
		, recordedAt: new Date().toISOString()
		, source: currentRevision()
		, profile
		, workload: Object.freeze({
			id: materialized.identity.workload.id
			, tier: materialized.identity.workload.tier
			, dimensions: materialized.identity.workload.dimensions
			, pointCount: materialized.initialPoints.length
			, operationCount: materialized.trace.length
			, contentSha256: materialized.contentSha256
			, resultSha256: materialized.resultSha256
			, manifestSha256: hashPerformanceWorkloadManifest(manifest)
		})
		, environment: Object.freeze({
			node: process.version
			, platform: process.platform
			, architecture: process.arch
			, clock: "node:perf_hooks.performance.now"
			, timingUnit: "nanoseconds"
		})
		, artifacts: Object.freeze(await artifactsFor(profile))
		, composition: Object.freeze({
			runtimeInstances: runtimes.length
			, moduleFactoryNs: Object.freeze(runtimes.map(runtime => runtime.moduleFactoryNs))
			, libraryLoadNs: Object.freeze(loadTimings)
			, diagnosticsBeforeShutdown: Object.freeze(diagnosticsBeforeShutdown)
			, shutdown: Object.freeze(shutdown)
		})
		, correctness: Object.freeze({
			accepted: true
			, checkedOperations: materialized.trace.length
			, resultSha256: materialized.resultSha256
		})
		, timing: Object.freeze(trace)
		, memory: Object.freeze({
			initialWasmBytes: runtimes.reduce(
				(sum, runtime) => sum + runtime.initialWasmMemoryBytes,
				0,
			)
			, finalWasmBytes: runtimes.reduce(
				(sum, runtime) => sum + runtime.module.HEAPU32.buffer.byteLength,
				0,
			)
			, processRssBefore: processMemoryBefore.rss
			, processRssAfter: processMemoryAfter.rss
		})
		, limitations: Object.freeze([
			"This profile run uses one process and does not establish a production budget."
			, "Process RSS includes Node, generated bindings, and harness state in addition to Wasm."
			, "The islands profile executes the workload in one of three isolated runtime instances and measures the duplicated runtime allocation across all three."
		])
	});
};

/**
 * Runs performance suite and returns a structured result suitable for the reproducible performance evidence pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to run performance suite.
 * @param root0.manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 * @param root0.workload - Validated workload definition executed under the selected runtime profile.
 * @param root0.profiles - Ordered runtime profiles executed to produce comparable performance evidence.
 */
export const runPerformanceSuite = async ({ manifest, workload, profiles }) => {
	const runs = [];
	for(const profile of profiles)
	{
		runs.push(await runPerformanceProfile({ manifest, workload, profile }));
	}
	return Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-performance-suite"
		, runs: Object.freeze(runs)
	});
};

export const performanceProfiles = Object.freeze(Object.keys(profileDefinitions));
