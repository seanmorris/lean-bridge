/**
 * Preserve the release-ready sparse-checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ReleaseReadySparseCheckoutRepairHistoryPath
	= "docs/evidence/vo1220-release-ready-sparse-checkout-repair-source-history-20261112.json";
export const vo1220ReleaseReadySparseCheckoutRepairPredecessor
	= "a9c3bc662688c06aebfdf52ecc552b670702ae31";
export const vo1220ReleaseReadySparseCheckoutRepairImplementation
	= "096ff1e24aa748087abee7c804a890809dee3597";
export const vo1220ReleaseReadySparseCheckoutRepairImplementationPaths
	= Object.freeze([
		".github/workflows/reproducible-release.yml"
		, "tests/reproducibility-gate.test.mjs"
	]);
export const vo1220ReleaseReadySparseCheckoutRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220ReleaseReadySparseCheckoutRepairAddedPaths
	= Object.freeze([
		"scripts/update-vo1220-release-ready-sparse-checkout-repair-source-history.mjs"
		, "tests/helpers/vo1220-release-ready-sparse-checkout-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-release-ready-sparse-checkout-repair-source-history.mjs"
	]);
export const vo1220ReleaseReadySparseCheckoutRepairNormalizationPaths
	= Object.freeze([
		...vo1220ReleaseReadySparseCheckoutRepairImplementationPaths
		, ...vo1220ReleaseReadySparseCheckoutRepairIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ReleaseReadySparseCheckoutRepairHistoryPath, "utf8"));

/**
 * Reverse one authenticated release-ready sparse-checkout transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220ReleaseReadySparseCheckoutRepairUpdate
	= (source, update) => {
		assert.ok(vo1220ReleaseReadySparseCheckoutRepairNormalizationPaths
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
 * Remove only the authenticated release-ready sparse-checkout repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ReleaseReadySparseCheckoutRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ReleaseReadySparseCheckoutRepairNormalizationPaths
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
			current = reverseVo1220ReleaseReadySparseCheckoutRepairUpdate(
				current, update);
	}
	return current;
};
