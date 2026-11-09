/**
 * Deterministically partition and authenticate the complete Core test profile.
 *
 * Shards are balanced by measured cost. Every contract file carries a cost in
 * scripts/core-contract-costs.json, whose provenance names the exact hosted
 * run, jobs and extraction method, and a longest-processing-time assignment
 * places each file, heaviest first, into the least-loaded shard. A path
 * missing from the manifest, or a manifest path outside the profile, fails
 * closed instead of receiving a silent default.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { groupRepositoryTests } from "../src/adoption/test-profiles.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";

export const coreContractShardCount = 12;
export const coreContractShardLabels = Object.freeze(
	Array.from({ length: coreContractShardCount }
		, (_, index) => `${index + 1}/${coreContractShardCount}`));
export const coreContractPartition = "cost-balanced-lpt-v1";
export const coreContractCostsPath = "scripts/core-contract-costs.json";
const partition = coreContractPartition;
const costSource = readFileSync(
	new URL("./core-contract-costs.json", import.meta.url), "utf8");
const measuredBases = Object.freeze([
	"sampler-max-etime"
	, "tap-duration-attributed"
	, "sampler-max-etime-less-attributed"
]);
const floorBases = Object.freeze([
	"unobserved-under-sampling-interval"
	, "unobserved-shard-4-no-completed-run"
]);
const costBases = Object.freeze([...measuredBases, ...floorBases]);

const assertPaths = paths => {
	assert.ok(Array.isArray(paths) && paths.length > 0);
	assert.ok(paths.every(path => typeof path === "string"
		&& /^tests\/(?:[^/]+\/)*[^/]+\.test\.mjs$/u.test(path)));
	assert.equal(new Set(paths).size, paths.length);
	assert.deepEqual(paths, paths.toSorted());
};

/**
 * Convert a recorded cost to whole centiminutes so shard loads add exactly.
 *
 * @param minutes - Positive cost with at most two decimals.
 */
const centiminutes = minutes => {
	assert.ok(Number.isFinite(minutes) && minutes > 0, "cost minutes must be positive");
	const value = Math.round(minutes * 100);
	assert.equal(value / 100, minutes, "cost minutes carry at most two decimals");
	return value;
};

const assertCostManifest = (source, manifest) => {
	assert.equal(source, canonicalJson(manifest), `${coreContractCostsPath} must be canonical`);
	assert.equal(manifest.schemaVersion, 1);
	assert.equal(manifest.kind, "core-contract-costs");
	assert.equal(manifest.partition, partition);
	assert.equal(manifest.shards, coreContractShardCount);
	assert.equal(manifest.units, "minutes");
	centiminutes(manifest.defaultMinutes);
	const { provenance } = manifest;
	assert.ok(provenance && typeof provenance === "object");
	assert.match(provenance.headSha, /^[a-f0-9]{40}$/u);
	assert.ok(Number.isSafeInteger(provenance.run) && provenance.run > 0);
	assert.ok(Number.isSafeInteger(provenance.attempt) && provenance.attempt > 0);
	assert.ok(typeof provenance.method === "string" && provenance.method.length > 0);
	assert.ok(provenance.jobs && typeof provenance.jobs === "object");
	const { previousContract } = provenance;
	if(previousContract !== undefined)
	{
		// A recorded predecessor ties this closed set to the one before it.
		assert.ok(Number.isSafeInteger(previousContract.count) && previousContract.count > 0);
		assert.match(previousContract.sha256, /^[a-f0-9]{64}$/u);
		for(const paths of [previousContract.added, previousContract.removed])
		{
			assert.ok(Array.isArray(paths));
			assert.deepEqual(paths, paths.toSorted());
			assert.equal(new Set(paths).size, paths.length);
		}
	}
	assert.ok(manifest.costs && typeof manifest.costs === "object");
	for(const [path, entry] of Object.entries(manifest.costs))
	{
		assert.match(path, /^tests\/(?:[^/]+\/)*[^/]+\.test\.mjs$/u);
		assert.ok(costBases.includes(entry.basis), `${path}: unknown cost basis ${entry.basis}`);
		centiminutes(entry.minutes);
		// Every row says whether it is a measurement or the declared floor.
		assert.equal(entry.measured, measuredBases.includes(entry.basis)
			, `${path}: measured must agree with the cost basis`);
		if(!entry.measured)
			assert.equal(entry.minutes, manifest.defaultMinutes
				, `${path}: unobserved files carry the declared default`);
	}
};

/**
 * Freeze a parsed JSON document at every level so no caller can alter it.
 *
 * @param value - Parsed JSON value; JSON carries no cycles.
 */
const deepFreeze = value => {
	if(value !== null && typeof value === "object" && !Object.isFrozen(value))
	{
		Object.freeze(value);
		for(const entry of Object.values(value)) deepFreeze(entry);
	}
	return value;
};

/** The committed cost manifest, authenticated once at import and deeply frozen. */
export const coreContractCostManifest = deepFreeze(JSON.parse(costSource));
assertCostManifest(costSource, coreContractCostManifest);
export const coreContractCostsSha256 = sha256(costSource);

/**
 * Digest of the cost manifest a plan was drawn from.
 *
 * @param manifest - Cost manifest; the committed one by default.
 */
const costsSha256 = manifest => manifest === coreContractCostManifest
	? coreContractCostsSha256 : sha256(canonicalJson(manifest));

/**
 * Resolve every contract path to its recorded cost in centiminutes.
 *
 * Fails closed: a contract path absent from the manifest, or a manifest path
 * no longer in the profile, is a planning error rather than a zero cost.
 *
 * @param paths - Every sorted Core contract test path.
 * @param manifest - Cost manifest; the committed one by default.
 */
export const coreContractCosts = (paths, manifest = coreContractCostManifest) => {
	assertPaths(paths);
	const known = new Set(Object.keys(manifest.costs)), profile = new Set(paths);
	const missing = paths.filter(path => !known.has(path));
	assert.deepEqual(missing, []
		, `${coreContractCostsPath} lacks ${missing.length} contract paths: ${missing.slice(0, 5).join(", ")}`);
	const stale = [...known].filter(path => !profile.has(path)).toSorted();
	assert.deepEqual(stale, []
		, `${coreContractCostsPath} cites ${stale.length} paths outside the contract profile: ${stale.slice(0, 5).join(", ")}`);
	return new Map(paths.map(path => [path, centiminutes(manifest.costs[path].minutes)]));
};

/**
 * Longest-processing-time assignment with explicit, total tie-breaking.
 *
 * Items are placed heaviest first, equal costs in ascending path order, each
 * into the shard with the smallest load so far, equal loads to the lowest
 * shard index. The result depends only on the cost map, so any checkout can
 * reproduce it.
 *
 * @param costs - Path to centiminutes.
 * @param count - Number of shards.
 */
export const planCostBalancedShards = (costs, count = coreContractShardCount) => {
	assert.ok(costs instanceof Map && costs.size > 0);
	assert.ok(Number.isSafeInteger(count) && count > 0);
	const order = [...costs.keys()].sort((left, right) =>
		costs.get(right) - costs.get(left) || (left < right ? -1 : left > right ? 1 : 0));
	const loads = Array.from({ length: count }, () => 0);
	const files = Array.from({ length: count }, () => []);
	for(const path of order)
	{
		let index = 0;
		for(let candidate = 1; candidate < count; candidate++)
			if(loads[candidate] < loads[index]) index = candidate;
		files[index].push(path); loads[index] += costs.get(path);
	}
	return files.map((selection, index) => Object.freeze({
		index: index + 1
		, files: Object.freeze(selection.toSorted())
		, centiminutes: loads[index]
	}));
};

/**
 * Enumerate every repository test in stable path order.
 *
 * @param root - Repository root whose tests are enumerated.
 */
export const collectRepositoryTestPaths = async (root = resolve(".")) => {
	const visit = async directory => {
		const paths = [];
		for(const entry of await readdir(directory, { withFileTypes: true }))
		{
			const path = resolve(directory, entry.name);
			if(entry.isDirectory()) paths.push(...await visit(path));
			else if(entry.isFile() && entry.name.endsWith(".test.mjs"))
				paths.push(relative(root, path).replaceAll("\\", "/"));
		}
		return paths;
	};
	return (await visit(resolve(root, "tests"))).toSorted();
};

/**
 * Enumerate the closed Core contract profile in stable path order.
 *
 * @param root - Repository root whose Core profile is selected.
 */
export const collectCoreContractTestPaths = async (root = resolve(".")) => {
	const grouped = groupRepositoryTests(await collectRepositoryTestPaths(root));
	assertPaths(grouped.contract);
	return grouped.contract;
};

/**
 * Plan every shard of the complete contract profile from recorded costs.
 *
 * @param paths - Every sorted Core contract test path.
 * @param manifest - Cost manifest; the committed one by default.
 */
export const coreContractShardPlan = (paths, manifest = coreContractCostManifest) =>
	planCostBalancedShards(coreContractCosts(paths, manifest), coreContractShardCount);

/**
 * Construct one exact shard manifest from the complete contract profile.
 *
 * @param paths - Every sorted Core contract test path.
 * @param label - One-based shard label `k/12`.
 * @param manifest - Cost manifest; the committed one by default.
 */
export const coreContractShardManifest = (
	paths, label, manifest = coreContractCostManifest
) => {
	assertPaths(paths);
	assert.ok(coreContractShardLabels.includes(label), `Unknown Core shard ${label}`);
	const index = Number(label.split("/")[0]);
	const shard = coreContractShardPlan(paths, manifest)[index - 1];
	const files = [...shard.files];
	assert.ok(files.length > 0);
	return {
		schemaVersion: 1, partition
		, shard: { index, total: coreContractShardCount }
		, contract: { count: paths.length, sha256: sha256(canonicalJson(paths)) }
		, costs: { sha256: costsSha256(manifest), minutes: shard.centiminutes / 100 }
		, selection: {
			count: files.length, sha256: sha256(canonicalJson(files)), files
		}
	};
};

/**
 * Recompute every expected shard and require an exact, disjoint full closure.
 *
 * @param paths - Every sorted Core contract test path.
 * @param manifests - Parsed canonical manifests in any order.
 */
export const verifyCoreContractShardManifests = (paths, manifests) => {
	assertPaths(paths);
	assert.equal(manifests.length, coreContractShardCount);
	const byLabel = new Map();
	for(const manifest of manifests)
	{
		assert.equal(manifest?.shard?.total, coreContractShardCount);
		const label = `${manifest.shard.index}/${manifest.shard.total}`;
		assert.ok(coreContractShardLabels.includes(label));
		assert.ok(!byLabel.has(label), `Duplicate Core shard ${label}`);
		byLabel.set(label, manifest);
	}
	const files = [];
	for(const label of coreContractShardLabels)
	{
		const expected = coreContractShardManifest(paths, label);
		assert.deepEqual(byLabel.get(label), expected, `Core shard ${label}`);
		files.push(...expected.selection.files);
	}
	assert.equal(new Set(files).size, paths.length);
	assert.deepEqual(files.toSorted(), paths);
	return {
		schemaVersion: 1, partition, shards: coreContractShardCount
		, contractFiles: paths.length, contractSha256: sha256(canonicalJson(paths))
		, costsSha256: coreContractCostsSha256
	};
};
