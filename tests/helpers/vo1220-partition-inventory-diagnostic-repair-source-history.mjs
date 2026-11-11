/**
 * Authenticate the complete retained-partition inventory diagnostic repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220PartitionInventoryDiagnosticRepairHistoryPath
	= "docs/evidence/vo1220-partition-inventory-diagnostic-repair-source-history-20261111.json";
export const vo1220PartitionInventoryDiagnosticRepairPredecessor
	= "ab49f595dd6d9641fe54ff722816d2fd3541e246";
export const vo1220PartitionInventoryDiagnosticRepairImplementation
	= "59730e76d369ce78a90537295669d6908e23c31f";
export const vo1220PartitionInventoryDiagnosticRepairImplementationPaths
	= Object.freeze([
		"tests/component-array-history-partition-01.test.mjs"
		, "tests/nested-checked-record-history-partition-05.test.mjs"
	]);
export const vo1220PartitionInventoryDiagnosticRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-history-partition-01.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220PartitionInventoryDiagnosticRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-partition-inventory-diagnostic-repair-source-history.mjs"
		, "tests/helpers/vo1220-partition-inventory-diagnostic-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-partition-inventory-diagnostic-repair-source-history.mjs"
	]);
export const vo1220PartitionInventoryDiagnosticRepairBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, productionCodeChanges: 0, repairedPartitionAudits: 2
	, aggregatedInventoryFields: 5
});

const historyUrl = new URL(
	`../../${vo1220PartitionInventoryDiagnosticRepairHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220PartitionInventoryDiagnosticRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220PartitionInventoryDiagnosticRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220PartitionInventoryDiagnosticRepairIntegrationPaths)
	])].sort());
const allowedPath = path =>
	vo1220PartitionInventoryDiagnosticRepairNormalizationPaths.includes(path);

/**
 * Require the repaired diagnostics without pinning their current inventory.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220PartitionInventoryDiagnosticRepair = sources => {
	for(const path of vo1220PartitionInventoryDiagnosticRepairImplementationPaths)
	{
		const source = sources[path];
		assert.equal(typeof source, "string", path);
		assert.doesNotMatch(source
			, /sources[.]map\(source =>[\s\S]{0,160}strictImport[\s\S]{0,160}\[[\d,\s]+\]/u
			, path);
		assert.match(source
			, /context[.]test\("audited membership and assignment match together"/u
			, path);
		assert.match(source, /assert[.]deepEqual\(\{[\s\S]+assignmentSha256:[\s\S]+helperSetSha256:[\s\S]+\}, expectedPartitionInventory\)/u
			, path);
		assert.match(source
			, /context[.]test\("every audited helper has exactly one Core owner"/u
			, path);
	}
	return { ...vo1220PartitionInventoryDiagnosticRepairBehavior };
};

/**
 * Reverse one authenticated partition-diagnostic transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220PartitionInventoryDiagnosticRepairUpdate = (
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
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
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
 * Remove only the authenticated diagnostic repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220PartitionInventoryDiagnosticRepairSource = (
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
			current = reverseVo1220PartitionInventoryDiagnosticRepairUpdate(
				current, update);
	}
	return current;
};
