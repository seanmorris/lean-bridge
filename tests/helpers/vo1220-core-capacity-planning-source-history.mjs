/**
 * Authenticate capacity-aware Core planning and its conservative cost refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220CoreCapacityPlanningHistoryPath
	= "docs/evidence/vo1220-core-capacity-planning-source-history-20261110.json";
export const vo1220CoreCapacityPlanningPredecessor
	= "1b737a87f47730d5c6182c485159fcefe4183078";
export const vo1220CoreCapacityPlanningImplementation
	= "08abcec3314c1f0ad8db52265adeb7f62f17a934";
export const vo1220CoreCapacityPlanningImplementationPaths = Object.freeze([
	"scripts/core-contract-costs.json"
	, "scripts/core-contract-shards.mjs"
	, "scripts/run-test-profile.mjs"
	, "tests/helpers/core-quality-budget-tests.mjs"
	, "tests/helpers/core-runner-resilience-source-history-tests.mjs"
	, "tests/helpers/vo1220-core-candidate-throughput-source-history-tests.mjs"
]);
export const vo1220CoreCapacityPlanningIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-12.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220CoreCapacityPlanningHistoryAdditions = Object.freeze([
	"scripts/update-vo1220-core-capacity-planning-source-history.mjs"
	, "tests/helpers/vo1220-core-capacity-planning-source-history-tests.mjs"
	, "tests/helpers/vo1220-core-capacity-planning-source-history.mjs"
]);
export const vo1220CoreCapacityPlanningBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, packageSemanticChanges: 0, productionCodeChanges: 0
	, contractRoots: 1123, priorMeasuredRoots: 337, measuredRoots: 369
	, priorFloorRoots: 786, floorRoots: 754
	, serialShard: 4, serialWorkers: 1, parallelWorkers: 2
	, priorObservedTestMinutes: 261.6830399045333
	, modeledTestMinutes: 159.64
	, modeledSavedMinutes: 102.04303990453332
	, modeledSavedPercent: 38.994900067562824
	, modeledSpeedup: 1.63920721563852
});

const historyUrl = new URL(
	`../../${vo1220CoreCapacityPlanningHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220CoreCapacityPlanningNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220CoreCapacityPlanningImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220CoreCapacityPlanningIntegrationPaths)
	])].sort());
const allowedPath = path =>
	vo1220CoreCapacityPlanningNormalizationPaths.includes(path);

/**
 * Require the measured cost set, worker capacities and runner to agree.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220CoreCapacityPlanning = sources => {
	for(const path of vo1220CoreCapacityPlanningImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const costs = JSON.parse(sources["scripts/core-contract-costs.json"]);
	assert.equal(costs.partition, "capacity-balanced-lpt-v2");
	assert.equal(costs.provenance.run, 42760203921);
	assert.equal(costs.provenance.headSha
		, "0d5103880ec0c998224cd141ca682722222d2c9b");
	assert.equal(costs.provenance.measuredRows, 369);
	assert.equal(costs.provenance.floorRows, 754);
	assert.equal(Object.values(costs.costs).filter(item => item.measured).length
		, 369);
	assert.equal(Object.values(costs.costs).filter(item => !item.measured).length
		, 754);
	assert.deepEqual(Object.keys(costs.provenance.jobs).map(Number)
		.toSorted((left, right) => left - right)
	, Array.from({ length: 12 }, (_, index) => index + 1));
	assert.equal(costs.provenance.previousCostManifest.sha256
		, "7a44754b45d5438ba7cc77942cf9f9db4b8e35a048161f631be3659ac697638f");
	const shards = sources["scripts/core-contract-shards.mjs"];
	assert.match(shards
		, /coreContractPartition = "capacity-balanced-lpt-v2"/u);
	assert.match(shards
		, /label === "4\/12" \? 1 : 2/u);
	assert.match(shards
		, /"4\/12": Object\.freeze\(\[coreContractSerialPath\]\)/u);
	assert.match(shards
		, /loads\[candidate\] \* capacities\[index\]/u);
	assert.match(shards
		, /concurrency: shard\.concurrency/u);
	assert.doesNotMatch(shards, /files: Object\.freeze\(selection\.toSorted\(\)\)/u);
	const runner = sources["scripts/run-test-profile.mjs"];
	assert.match(runner
		, /manifest\?\.costs\.concurrency \?\? 2/u);
	assert.doesNotMatch(runner, /shard === "4\/12"/u);
	const quality = sources["tests/helpers/core-quality-budget-tests.mjs"];
	assert.match(quality, /normalized shard loads/u);
	assert.match(quality, /previousCostManifest\.sha256/u);
	const resilience = sources[
		"tests/helpers/core-runner-resilience-source-history-tests.mjs"];
	assert.match(resilience, /item\.costs\.concurrency/u);
	const throughput = sources[
		"tests/helpers/vo1220-core-candidate-throughput-source-history-tests.mjs"];
	assert.match(throughput, /planCostBalancedShards/u);
	assert.doesNotMatch(throughput, /coreContractShardManifest/u);
	return { ...vo1220CoreCapacityPlanningBehavior };
};

/**
 * Reverse one authenticated capacity-planning transition.
 *
 * @param source - Exact later source.
 * @param update - Exact transition for the same path.
 */
export const reverseVo1220CoreCapacityPlanningUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated capacity-planning repair and registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220CoreCapacityPlanningSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || !allowedPath(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220CoreCapacityPlanningUpdate(current, update);
	}
	return current;
};
