/**
 * Preserve the component clone source-metadata repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ComponentCloneSourceMetadataRepairHistoryPath
	= "docs/evidence/vo1220-component-clone-source-metadata-repair-source-history-20261113.json";
export const vo1220ComponentCloneSourceMetadataRepairPredecessor
	= "63cb5178f352d6b651073fbb651317ef7040045c";
export const vo1220ComponentCloneSourceMetadataRepairImplementation
	= "835bf1f5eca7495df8e180bb4c58e4d5beb050ba";
export const vo1220ComponentCloneSourceMetadataRepairImplementationPaths
	= Object.freeze([
		"src/release/component-reproducibility-gate.mjs"
		, "tests/lake-component-input.test.mjs"
		, "tests/reproducibility-gate.test.mjs"
	]);
export const vo1220ComponentCloneSourceMetadataRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220ComponentCloneSourceMetadataRepairAddedPaths
	= Object.freeze([
		"scripts/update-vo1220-component-clone-source-metadata-repair-source-history.mjs"
		, "tests/helpers/vo1220-component-clone-source-metadata-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-component-clone-source-metadata-repair-source-history.mjs"
	]);
export const vo1220ComponentCloneSourceMetadataRepairNormalizationPaths
	= Object.freeze([
		...vo1220ComponentCloneSourceMetadataRepairImplementationPaths
		, ...vo1220ComponentCloneSourceMetadataRepairIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ComponentCloneSourceMetadataRepairHistoryPath, "utf8"));

/**
 * Reverse one authenticated component clone source-metadata transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220ComponentCloneSourceMetadataRepairUpdate
	= (source, update) => {
		assert.ok(vo1220ComponentCloneSourceMetadataRepairNormalizationPaths
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
 * Remove only the authenticated component clone source-metadata repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ComponentCloneSourceMetadataRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ComponentCloneSourceMetadataRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected)
			return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ComponentCloneSourceMetadataRepairUpdate(
				current, update);
	}
	return current;
};
