/**
 * Preserve the release-gate partial-clone repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ReleaseGatePartialCloneRepairHistoryPath
	= "docs/evidence/vo1220-release-gate-partial-clone-repair-source-history-20261112.json";
export const vo1220ReleaseGatePartialCloneRepairPredecessor
	= "2c9ab2d96f103ab5b807b745167f13602b3949aa";
export const vo1220ReleaseGatePartialCloneRepairImplementation
	= "d9f2199a67ac9bcfc7c028b1c66a101259eb812d";
export const vo1220ReleaseGatePartialCloneRepairImplementationPaths
	= Object.freeze([
		".github/workflows/reproducible-release.yml"
		, "tests/reproducibility-gate.test.mjs"
	]);
export const vo1220ReleaseGatePartialCloneRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220ReleaseGatePartialCloneRepairAddedPaths = Object.freeze([
	"scripts/update-vo1220-release-gate-partial-clone-repair-source-history.mjs"
	, "tests/helpers/vo1220-release-gate-partial-clone-repair-source-history-tests.mjs"
	, "tests/helpers/vo1220-release-gate-partial-clone-repair-source-history.mjs"
]);
export const vo1220ReleaseGatePartialCloneRepairNormalizationPaths
	= Object.freeze([
		...vo1220ReleaseGatePartialCloneRepairImplementationPaths
		, ...vo1220ReleaseGatePartialCloneRepairIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ReleaseGatePartialCloneRepairHistoryPath, "utf8"));

/**
 * Reverse one authenticated release-gate partial-clone transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220ReleaseGatePartialCloneRepairUpdate
	= (source, update) => {
		assert.ok(vo1220ReleaseGatePartialCloneRepairNormalizationPaths
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
 * Remove only the authenticated release-gate partial-clone repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ReleaseGatePartialCloneRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ReleaseGatePartialCloneRepairNormalizationPaths.includes(path))
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
			current = reverseVo1220ReleaseGatePartialCloneRepairUpdate(
				current, update);
	}
	return current;
};
