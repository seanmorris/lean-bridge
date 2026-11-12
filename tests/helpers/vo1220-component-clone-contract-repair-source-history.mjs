/**
 * Preserve the component clone-lifetime contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ComponentCloneContractRepairHistoryPath
	= "docs/evidence/vo1220-component-clone-contract-repair-source-history-20261112.json";
export const vo1220ComponentCloneContractRepairPredecessor
	= "af17be8e63f792f61d2f48e4e8b4e584d4097620";
export const vo1220ComponentCloneContractRepairImplementation
	= "51021c8133627528f11f0f2cb4cfd73c60def409";
export const vo1220ComponentCloneContractRepairImplementationPaths
	= Object.freeze(["tests/reproducibility-gate.test.mjs"]);
export const vo1220ComponentCloneContractRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220ComponentCloneContractRepairAddedPaths = Object.freeze([
	"scripts/update-vo1220-component-clone-contract-repair-source-history.mjs"
	, "tests/helpers/vo1220-component-clone-contract-repair-source-history-tests.mjs"
	, "tests/helpers/vo1220-component-clone-contract-repair-source-history.mjs"
]);
export const vo1220ComponentCloneContractRepairNormalizationPaths
	= Object.freeze([
		...vo1220ComponentCloneContractRepairImplementationPaths
		, ...vo1220ComponentCloneContractRepairIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ComponentCloneContractRepairHistoryPath, "utf8"));

/**
 * Reverse one authenticated clone-lifetime contract transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220ComponentCloneContractRepairUpdate
	= (source, update) => {
		assert.ok(vo1220ComponentCloneContractRepairNormalizationPaths
			.includes(update.path), update.path);
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
 * Remove only the authenticated clone-lifetime contract repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ComponentCloneContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ComponentCloneContractRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected)
			return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ComponentCloneContractRepairUpdate(
				current, update);
	}
	return current;
};
