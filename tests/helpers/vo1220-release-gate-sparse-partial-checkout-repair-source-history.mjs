/**
 * Preserve the release-gate sparse partial-checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ReleaseGateSparsePartialCheckoutRepairHistoryPath
	= "docs/evidence/vo1220-release-gate-sparse-partial-checkout-repair-source-history-20261112.json";
export const vo1220ReleaseGateSparsePartialCheckoutRepairPredecessor
	= "823771b9a639f43413fdbe0437f8acd10a33b888";
export const vo1220ReleaseGateSparsePartialCheckoutRepairImplementation
	= "e318f012b299d49db37dcc1bdd8938c22e689f6d";
export const vo1220ReleaseGateSparsePartialCheckoutRepairImplementationPaths
	= Object.freeze([
		".github/workflows/reproducible-release.yml"
		, "tests/reproducibility-gate.test.mjs"
	]);
export const vo1220ReleaseGateSparsePartialCheckoutRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220ReleaseGateSparsePartialCheckoutRepairAddedPaths
	= Object.freeze([
		"scripts/update-vo1220-release-gate-sparse-partial-checkout-repair-source-history.mjs"
		, "tests/helpers/vo1220-release-gate-sparse-partial-checkout-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-release-gate-sparse-partial-checkout-repair-source-history.mjs"
	]);
export const vo1220ReleaseGateSparsePartialCheckoutRepairNormalizationPaths
	= Object.freeze([
		...vo1220ReleaseGateSparsePartialCheckoutRepairImplementationPaths
		, ...vo1220ReleaseGateSparsePartialCheckoutRepairIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ReleaseGateSparsePartialCheckoutRepairHistoryPath, "utf8"));

/**
 * Reverse one authenticated sparse partial-checkout transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220ReleaseGateSparsePartialCheckoutRepairUpdate
	= (source, update) => {
		assert.ok(vo1220ReleaseGateSparsePartialCheckoutRepairNormalizationPaths
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
 * Remove only the authenticated sparse partial-checkout repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ReleaseGateSparsePartialCheckoutRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ReleaseGateSparsePartialCheckoutRepairNormalizationPaths
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
			current = reverseVo1220ReleaseGateSparsePartialCheckoutRepairUpdate(
				current, update);
	}
	return current;
};
