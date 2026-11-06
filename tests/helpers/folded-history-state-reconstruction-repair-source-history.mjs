/**
 * Preserve the folded source-history state reconstruction repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const foldedHistoryStateReconstructionRepairHistoryPath
	= "docs/evidence/folded-history-state-reconstruction-repair-source-history-20261106.json";
export const foldedHistoryStateReconstructionRepairPredecessor
	= "d68bae2bd688777b7ae635534da962d2f40de80f";
export const foldedHistoryStateReconstructionRepairImplementation
	= "ce24b7c0aaf7dc034cb4aa1bcb05859821421a26";
export const foldedHistoryStateReconstructionRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/native-subtype-result-projection-repair-source-history-tests.mjs"
		, "tests/helpers/owned-javascript-ci-budget-repair-source-history-tests.mjs"
		, "tests/helpers/owned-javascript-historical-assertion-reader-repair-source-history-tests.mjs"
	]);
export const foldedHistoryStateReconstructionRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const foldedHistoryStateReconstructionRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-folded-history-state-reconstruction-repair-source-history.mjs"
		, "tests/helpers/folded-history-state-reconstruction-repair-source-history-tests.mjs"
		, "tests/helpers/folded-history-state-reconstruction-repair-source-history.mjs"
	]);
export const foldedHistoryStateReconstructionRepairBehavior = Object.freeze({
	foldedReaders: 3, reconstructedMilestoneCallSites: 6
	, livePinRefreshes: 0, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL("../../"
	+ foldedHistoryStateReconstructionRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const foldedHistoryStateReconstructionRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: foldedHistoryStateReconstructionRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...foldedHistoryStateReconstructionRepairImplementationPaths
	, ...foldedHistoryStateReconstructionRepairIntegrationPaths
].includes(path);
const count = (source, needle) => source.split(needle).length - 1;

/**
 * Require folded integration states to be reconstructed through the hub.
 *
 * @param {Record<string, string>} sources - Implementation sources by path.
 */
export const assertFoldedHistoryStateReconstructionRepair = sources => {
	let milestoneCallSites = 0;
	for(const path of foldedHistoryStateReconstructionRepairImplementationPaths)
	{
		const source = sources[path];
		assert.equal(typeof source, "string", path);
		assert.equal(count(source, "sourceAtFinHistoryRecordSource"), 0, path);
		assert.match(source, /import \{ sourceAtFinHistoryMilestone \}/u, path);
		milestoneCallSites += count(source
			, "await sourceAtFinHistoryMilestone(") - 1;
	}
	assert.equal(milestoneCallSites
		, foldedHistoryStateReconstructionRepairBehavior
			.reconstructedMilestoneCallSites);
	return { ...foldedHistoryStateReconstructionRepairBehavior };
};

/**
 * Reverse one authenticated folded-history reader transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseFoldedHistoryStateReconstructionRepairUpdate = (
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
 * Remove only authenticated folded-history reader transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeFoldedHistoryStateReconstructionRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !foldedHistoryStateReconstructionRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseFoldedHistoryStateReconstructionRepairUpdate(
				current, update);
	}
	return current;
};
