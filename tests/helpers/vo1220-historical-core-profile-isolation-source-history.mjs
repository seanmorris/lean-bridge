/**
 * Authenticate isolation of historical Core profiles from the live planner.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220HistoricalCoreProfileIsolationHistoryPath
	= "docs/evidence/vo1220-historical-core-profile-isolation-source-history-20261110.json";
export const vo1220HistoricalCoreProfileIsolationPredecessor
	= "0d5103880ec0c998224cd141ca682722222d2c9b";
export const vo1220HistoricalCoreProfileIsolationImplementation
	= "f8eb983121f2d158c53babf5cbc83b6d9b6a9a50";
export const vo1220HistoricalCoreProfileIsolationImplementationPaths
	= Object.freeze([
		"tests/helpers/core-final-audit-registration-source-history-tests.mjs"
		, "tests/helpers/core-final-test-registration-source-history-tests.mjs"
	]);
export const vo1220HistoricalCoreProfileIsolationIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220HistoricalCoreProfileIsolationHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-historical-core-profile-isolation-source-history.mjs"
		, "tests/helpers/vo1220-historical-core-profile-isolation-source-history-tests.mjs"
		, "tests/helpers/vo1220-historical-core-profile-isolation-source-history.mjs"
	]);
export const vo1220HistoricalCoreProfileIsolationBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, packageSemanticChanges: 0, productionCodeChanges: 0
	, repairedHistoricalProfiles: 2
	, historicalContractFiles: Object.freeze([1093, 1094])
	, liveCostManifestDependencies: 0
});

const historyUrl = new URL(
	`../../${vo1220HistoricalCoreProfileIsolationHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220HistoricalCoreProfileIsolationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220HistoricalCoreProfileIsolationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220HistoricalCoreProfileIsolationIntegrationPaths)
	])].sort());
const allowedPath = path =>
	vo1220HistoricalCoreProfileIsolationNormalizationPaths.includes(path);

/**
 * Require both historical profile checks to authenticate only their recorded
 * canonical contract-set digest.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220HistoricalCoreProfileIsolation = sources => {
	for(const path of vo1220HistoricalCoreProfileIsolationImplementationPaths)
	{
		const source = sources[path];
		assert.equal(typeof source, "string", path);
		assert.match(source
			, /import \{ canonicalJson \} from "\.\.\/\.\.\/src\/capsule\/node\.mjs";/u
			, path);
		assert.match(source
			, /assert\.equal\(sha256\(canonicalJson\(paths\)\), history\.contractSha256\);/u
			, path);
		assert.doesNotMatch(source
			, /coreContractShardLabels|coreContractShardManifest|verifyCoreContractShardManifests/u
			, path);
	}
	return { ...vo1220HistoricalCoreProfileIsolationBehavior
		, historicalContractFiles:
			[...vo1220HistoricalCoreProfileIsolationBehavior.historicalContractFiles] };
};

/**
 * Reverse one authenticated historical-profile isolation transition.
 *
 * @param source - Exact later source.
 * @param update - Exact transition for the same path.
 */
export const reverseVo1220HistoricalCoreProfileIsolationUpdate = (
	source, update
) => {
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
 * Remove only the authenticated profile-isolation repair and registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220HistoricalCoreProfileIsolationSource = (
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
			current = reverseVo1220HistoricalCoreProfileIsolationUpdate(
				current, update);
	}
	return current;
};
