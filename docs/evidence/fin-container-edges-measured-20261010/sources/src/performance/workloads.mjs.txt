/**
 * Implements the workloads module in the performance subsystem.
 *
 * @file
 */

import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";
import { sha256Text } from "../binding-ir/sha256.mjs";

const shaPattern = /^[0-9a-f]{64}$/;
const dimensionsAllowed = new Set([2, 4, 8]);
const distributionKinds = new Set(["uniform", "clustered", "diagonal-degenerate"]);
const tiers = new Set(["browser-safe", "extended-node"]);
const scales = new Set(["small", "medium", "large", "adversarial"]);

/**
 * Reports performance workload failures with stable machine-readable codes and structured diagnostic context.
 */
export class PerformanceWorkloadError extends Error
{
	/**
   * Initializes the error used to report performance workload failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "PerformanceWorkloadError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new PerformanceWorkloadError(code, message, details);
};

const object = (value, path) => {
	if(!value || typeof value !== "object" || Array.isArray(value))
	{
		fail("invalid-object", `${path} must be an object`, { path });
	}
	return value;
};

const exactKeys = (value, keys, path) => {
	object(value, path);
	const expected = new Set(keys);
	const missing = keys.filter(key => !(key in value));
	const unknown = Object.keys(value).filter(key => !expected.has(key));
	if(missing.length || unknown.length)
	{
		fail("closed-contract", `${path} has missing or unknown fields`, { path, missing, unknown });
	}
};

const integer = (value, path, minimum, maximum) => {
	if(!Number.isSafeInteger(value) || value < minimum || value > maximum)
	{
		fail("invalid-integer", `${path} must be an integer from ${minimum} through ${maximum}`, {
			path
			, actual: value
		});
	}
	return value;
};

const ratio = (value, path) => {
	if(typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
	{
		fail("invalid-ratio", `${path} must be a number from 0 through 1`, { path, actual: value });
	}
};

const oneOf = (value, allowed, path) => {
	if(!allowed.has(value)) fail("invalid-enum", `${path} has unsupported value ${String(value)}`, { path });
};

const nonempty = (value, path) => {
	if(typeof value !== "string" || value.length === 0)
	{
		fail("invalid-string", `${path} must be a non-empty string`, { path });
	}
};

const operationNames = Object.freeze([
	"warmupQueries"
	, "lowerBound"
	, "nearest"
	, "range"
	, "insert"
	, "consumerRangeChecksum"
]);

const validateWorkload = (workload, path) => {
	exactKeys(workload, [
		"id", "tier", "scale", "seed", "dimensions", "pointCount", "distribution"
		, "queryProfile", "operations", "expected"
	], path);
	nonempty(workload.id, `${path}.id`);
	oneOf(workload.tier, tiers, `${path}.tier`);
	oneOf(workload.scale, scales, `${path}.scale`);
	integer(workload.seed, `${path}.seed`, 0, 0xffff_ffff);
	oneOf(workload.dimensions, dimensionsAllowed, `${path}.dimensions`);
	integer(workload.pointCount, `${path}.pointCount`, 1, 1_000_000);

	exactKeys(workload.distribution, [
		"kind"
		, "coordinateMinimum"
		, "coordinateMaximum"
		, "clusterCount"
		, "clusterRadius"
		, "duplicateCoordinateRate"
	], `${path}.distribution`);
	oneOf(workload.distribution.kind, distributionKinds, `${path}.distribution.kind`);
	integer(workload.distribution.coordinateMinimum, `${path}.distribution.coordinateMinimum`, -32768, 32767);
	integer(
		workload.distribution.coordinateMaximum,
		`${path}.distribution.coordinateMaximum`,
		workload.distribution.coordinateMinimum,
		32767,
	);
	integer(workload.distribution.clusterCount, `${path}.distribution.clusterCount`, 1, 1024);
	integer(workload.distribution.clusterRadius, `${path}.distribution.clusterRadius`, 0, 32767);
	ratio(workload.distribution.duplicateCoordinateRate, `${path}.distribution.duplicateCoordinateRate`);

	exactKeys(workload.queryProfile, ["keyLocality", "hitRatio", "rangeRadius"], `${path}.queryProfile`);
	ratio(workload.queryProfile.keyLocality, `${path}.queryProfile.keyLocality`);
	ratio(workload.queryProfile.hitRatio, `${path}.queryProfile.hitRatio`);
	integer(workload.queryProfile.rangeRadius, `${path}.queryProfile.rangeRadius`, 0, 32767);

	exactKeys(workload.operations, operationNames, `${path}.operations`);
	operationNames.forEach(name => integer(workload.operations[name], `${path}.operations.${name}`, 0, 1_000_000));

	exactKeys(workload.expected, ["contentSha256", "resultSha256", "operationCount"], `${path}.expected`);
	for(const name of ["contentSha256", "resultSha256"])
	{
		if(!shaPattern.test(workload.expected[name]))
		{
			fail("invalid-hash", `${path}.expected.${name} must be a lowercase SHA-256`, { path });
		}
	}
	const expectedCount = 2 + workload.operations.warmupQueries
    + operationNames.slice(1).reduce((sum, name) => sum + workload.operations[name], 0);
	if(workload.expected.operationCount !== expectedCount)
	{
		fail("operation-count-drift", `${path}.expected.operationCount must equal ${expectedCount}`, {
			path
			, expected: expectedCount
			, actual: workload.expected.operationCount
		});
	}
};

/**
 * Validates performance workloads against its closed contract before it enters the reproducible performance evidence pipeline.
 *
 * @param value - Workload manifest whose scenarios, iteration counts, and references must satisfy the closed schema.
 */
export const validatePerformanceWorkloads = value => {
	exactKeys(value, ["schemaVersion", "id", "version", "generator", "license", "workloads"], "workloads");
	if(value.schemaVersion !== 1) fail("unsupported-schema", "workloads.schemaVersion must be 1");
	nonempty(value.id, "workloads.id");
	if(!/^\d+\.\d+\.\d+$/.test(value.version)) fail("invalid-version", "workloads.version must be semantic");
	exactKeys(value.generator, ["id", "version", "algorithm"], "workloads.generator");
	if(
		value.generator.id !== "lean-bridge-spatial-workload"
    || value.generator.version !== "1.0.0"
    || value.generator.algorithm !== "mulberry32-integer-v1"
	) fail("unsupported-generator", "workloads.generator is not the reviewed deterministic generator");
	if(value.license !== "CC0-1.0") fail("unsupported-license", "workloads.license must be CC0-1.0");
	if(!Array.isArray(value.workloads) || value.workloads.length === 0)
	{
		fail("missing-workloads", "workloads.workloads must contain at least one workload");
	}
	const ids = new Set();
	value.workloads.forEach((workload, index) => {
    validateWorkload(workload, `workloads.workloads[${index}]`);
    if(ids.has(workload.id)) fail("duplicate-workload", `duplicate workload ${workload.id}`);
    ids.add(workload.id);
	});
	if(!value.workloads.some(workload => workload.tier === "browser-safe"))
	{
		fail("missing-tier", "workloads require a browser-safe tier");
	}
	if(!value.workloads.some(workload => workload.tier === "extended-node"))
	{
		fail("missing-tier", "workloads require an extended-node tier");
	}
	if(!value.workloads.some(workload => workload.scale === "adversarial"))
	{
		fail("missing-adversarial", "workloads require an adversarial fixture");
	}
	return value;
};

const mulberry32 = initialSeed => {
	let seed = initialSeed >>> 0;
	return () => {
		seed = (seed + 0x6d2b79f5) >>> 0;
		let value = seed;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
	};
};

const randomInteger = (random, minimum, maximum) =>
	minimum + Math.floor(random() * (maximum - minimum + 1));

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

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

const coordinatesFor = (workload, random, index, prior, centers) => {
	const distribution = workload.distribution;
	if(prior.length > 0 && random() < distribution.duplicateCoordinateRate)
	{
		return [...prior[randomInteger(random, 0, prior.length - 1)].coordinates];
	}
	if(distribution.kind === "diagonal-degenerate")
	{
		const span = distribution.coordinateMaximum - distribution.coordinateMinimum + 1;
		const coordinate = distribution.coordinateMinimum + (index % span);
		return Array(workload.dimensions).fill(coordinate);
	}
	if(distribution.kind === "clustered")
	{
		const center = centers[index % centers.length];
		return center.map(value => clamp(
			value + randomInteger(random, -distribution.clusterRadius, distribution.clusterRadius),
			distribution.coordinateMinimum,
			distribution.coordinateMaximum,
		));
	}
	return Array.from({ length: workload.dimensions }, () =>
		randomInteger(random, distribution.coordinateMinimum, distribution.coordinateMaximum));
};

const makeInitialPoints = (workload, random) => {
	const coordinate = () => randomInteger(
		random
		, workload.distribution.coordinateMinimum
		, workload.distribution.coordinateMaximum
	);
	const center = () => Array.from({ length: workload.dimensions }, coordinate);
	const centers = Array.from({ length: workload.distribution.clusterCount }, center);
	const points = [];
	for(let index = 0; index < workload.pointCount; index += 1)
	{
		points.push({
			id: index + 1
			, coordinates: coordinatesFor(workload, random, index, points, centers)
		});
	}
	return { points: points.sort(comparePoints), centers };
};

const lowerBound = (points, query) => {
	let lower = 0;
	let upper = points.length;
	while(lower < upper)
	{
		const middle = lower + Math.floor((upper - lower) / 2);
		if(compareCoordinates(points[middle].coordinates, query) < 0) lower = middle + 1;
		else upper = middle;
	}
	return lower;
};

const squaredDistance = (left, right) => left.reduce((sum, value, index) => {
  const difference = value - right[index];
  return sum + difference * difference;
}, 0);

const nearest = (points, query) => {
	let result = points[0];
	let distance = squaredDistance(result.coordinates, query);
	for(let index = 1; index < points.length; index += 1)
	{
		const candidate = points[index];
		const candidateDistance = squaredDistance(candidate.coordinates, query);
		if(candidateDistance < distance || (candidateDistance === distance && candidate.id < result.id))
		{
			result = candidate;
			distance = candidateDistance;
		}
	}
	return { pointId: result.id, coordinates: [...result.coordinates], squaredDistance: distance };
};

const range = (points, minimum, maximum) => points
  .filter(point => point.coordinates.every((coordinate, index) =>
		coordinate >= minimum[index] && coordinate <= maximum[index]))
  .map(point => point.id)
  .sort((left, right) => left - right);

const selectPoint = (state, workload, random) => {
	if(random() < workload.queryProfile.keyLocality)
	{
		state.cursor = clamp(
			state.cursor + randomInteger(random, -3, 3),
			0,
			state.points.length - 1,
		);
	} else
	{
		state.cursor = randomInteger(random, 0, state.points.length - 1);
	}
	return state.points[state.cursor];
};

const queryFor = (state, workload, random) => {
	const point = selectPoint(state, workload, random);
	const query = [...point.coordinates];
	if(random() >= workload.queryProfile.hitRatio)
	{
		const dimension = randomInteger(random, 0, workload.dimensions - 1);
		const delta = random() < 0.5 ? -1 : 1;
		query[dimension] = clamp(
			query[dimension] + delta,
			workload.distribution.coordinateMinimum,
			workload.distribution.coordinateMaximum,
		);
	}
	return query;
};

const rangeFor = (state, workload, random) => {
	const point = selectPoint(state, workload, random);
	const radius = workload.queryProfile.rangeRadius;
	return {
		minimum: point.coordinates.map(value => clamp(
			value - radius,
			workload.distribution.coordinateMinimum,
			workload.distribution.coordinateMaximum,
		))
		, maximum: point.coordinates.map(value => clamp(
			value + radius,
			workload.distribution.coordinateMinimum,
			workload.distribution.coordinateMaximum,
		))
	};
};

const shuffle = (values, random) => {
	for(let index = values.length - 1; index > 0; index -= 1)
	{
		const target = randomInteger(random, 0, index);
		[values[index], values[target]] = [values[target], values[index]];
	}
	return values;
};

const appendOperation = (state, workload, random, phase, call) => {
	let argumentsValue;
	let result;
	if(call === "lowerBound")
	{
		const query = queryFor(state, workload, random);
		argumentsValue = { query };
		result = { index: lowerBound(state.points, query) };
	} else if(call === "nearest")
	{
		const query = queryFor(state, workload, random);
		argumentsValue = { query };
		result = nearest(state.points, query);
	} else if(call === "range" || call === "consumerRangeChecksum")
	{
		const bounds = rangeFor(state, workload, random);
		const pointIds = range(state.points, bounds.minimum, bounds.maximum);
		argumentsValue = bounds;
		result = call === "range"
			? { pointIds }
			: { pointIds, checksum: pointIds.reduce((sum, id) => sum + id, 0) };
	} else if(call === "insert")
	{
		const point = {
			id: state.nextId
			, coordinates: coordinatesFor(workload, random, state.nextId, state.points, state.centers)
		};
		state.nextId += 1;
		state.points.push(point);
		state.points.sort(comparePoints);
		argumentsValue = { point };
		result = { size: state.points.length };
	} else
	{
		throw new Error(`unsupported generated operation ${call}`);
	}
	const sequence = state.trace.length;
	state.trace.push({ sequence, phase, call, arguments: argumentsValue });
	state.results.push({ sequence, call, result });
};

const workloadIdentity = (manifest, workload) => ({
	schemaVersion: manifest.schemaVersion
	, manifestId: manifest.id
	, manifestVersion: manifest.version
	, generator: manifest.generator
	, license: manifest.license
	, workload: Object.fromEntries(Object.entries(workload).filter(([key]) => key !== "expected"))
});

/**
 * Prepares performance workload in an isolated, deterministic form for the reproducible performance evidence pipeline.
 *
 * @param manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 * @param requested - Requested library roots or workload identity resolved against the available catalog.
 * @param options - Verification control used when materializing workloads before or after expected hashes are available.
 */
export const materializePerformanceWorkload = (manifest, requested, options = {}) => {
	validatePerformanceWorkloads(manifest);
	const workload = typeof requested === "string"
		? manifest.workloads.find(candidate => candidate.id === requested)
		: requested;
	if(!workload || !manifest.workloads.includes(workload))
	{
		fail("unknown-workload", `unknown workload ${String(requested)}`);
	}
	const random = mulberry32(workload.seed);
	const generated = makeInitialPoints(workload, random);
	const initialPoints = generated.points;
	const state = {
		points: initialPoints.map(point => ({ id: point.id, coordinates: [...point.coordinates] }))
		, trace: [{ sequence: 0, phase: "setup", call: "build", arguments: {} }]
		, results: [{ sequence: 0, call: "build", result: { size: initialPoints.length } }]
		, cursor: 0
		, nextId: workload.pointCount + 1
		, centers: generated.centers
	};

	for(let index = 0; index < workload.operations.warmupQueries; index += 1)
	{
		appendOperation(state, workload, random, "warmup", index % 2 === 0 ? "lowerBound" : "nearest");
	}
	const measured = [];
	for(const name of operationNames.slice(1))
	{
		for(let index = 0; index < workload.operations[name]; index += 1) measured.push(name);
	}
	for(const name of shuffle(measured, random)) appendOperation(state, workload, random, "measure", name);

	const sequence = state.trace.length;
	state.trace.push({ sequence, phase: "cleanup", call: "dispose", arguments: {} });
	state.results.push({ sequence, call: "dispose", result: { released: true } });

	const identity = workloadIdentity(manifest, workload);
	const contentSha256 = sha256Text(canonicalizeJsonValue({ identity, initialPoints, trace: state.trace }));
	const resultSha256 = sha256Text(canonicalizeJsonValue(state.results));
	const materialized = Object.freeze({
		identity: Object.freeze(identity)
		, initialPoints: Object.freeze(initialPoints)
		, trace: Object.freeze(state.trace)
		, expectedResults: Object.freeze(state.results)
		, contentSha256
		, resultSha256
	});
	if(options.verify !== false)
	{
		if(contentSha256 !== workload.expected.contentSha256)
		{
			fail("content-drift", `${workload.id} content hash drifted`, {
				expected: workload.expected.contentSha256
				, actual: contentSha256
			});
		}
		if(resultSha256 !== workload.expected.resultSha256)
		{
			fail("result-drift", `${workload.id} result hash drifted`, {
				expected: workload.expected.resultSha256
				, actual: resultSha256
			});
		}
	}
	return materialized;
};

/**
 * Prepares performance tier in an isolated, deterministic form for the reproducible performance evidence pipeline.
 *
 * @param manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 * @param tier - Named workload-size tier materialized from the performance corpus.
 * @param options - Verification control forwarded to every workload in the selected tier.
 */
export const materializePerformanceTier = (manifest, tier, options = {}) => {
	validatePerformanceWorkloads(manifest);
	oneOf(tier, tiers, "tier");
	return Object.freeze(manifest.workloads
    .filter(workload => workload.tier === tier)
    .map(workload => materializePerformanceWorkload(manifest, workload, options)));
};

/**
 * Computes a stable content identity for performance workload manifest so the reproducible performance evidence pipeline can reject drift.
 *
 * @param manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 */
export const hashPerformanceWorkloadManifest = manifest => {
	validatePerformanceWorkloads(manifest);
	return sha256Text(canonicalizeJsonValue(manifest));
};
