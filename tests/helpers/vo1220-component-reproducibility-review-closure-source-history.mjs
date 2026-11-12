/**
 * Preserve the final component reproducibility review closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ComponentReproducibilityReviewClosureHistoryPath
	= "docs/evidence/vo1220-component-reproducibility-review-closure-source-history-20261112.json";
export const vo1220ComponentReproducibilityReviewClosurePredecessor
	= "340dca40d108471bf2f3eb7763321e0cb4c191f1";
export const vo1220ComponentReproducibilityReviewClosureImplementation
	= "982e37bd198f78b69811aa1c176ea71772996de7";
export const vo1220ComponentReproducibilityReviewClosureImplementationPaths
	= Object.freeze([
		"src/release/component-reproducibility-gate.mjs"
		, "tests/canonical-build.test.mjs"
		, "tests/lake-component-input.test.mjs"
	]);
export const vo1220ComponentReproducibilityReviewClosureIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220ComponentReproducibilityReviewClosureAddedPaths
	= Object.freeze([
		"scripts/update-vo1220-component-reproducibility-review-closure-source-history.mjs"
		, "tests/helpers/vo1220-component-reproducibility-review-closure-source-history-tests.mjs"
		, "tests/helpers/vo1220-component-reproducibility-review-closure-source-history.mjs"
	]);
export const vo1220ComponentReproducibilityReviewClosureNormalizationPaths
	= Object.freeze([
		...vo1220ComponentReproducibilityReviewClosureImplementationPaths
		, ...vo1220ComponentReproducibilityReviewClosureIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ComponentReproducibilityReviewClosureHistoryPath, "utf8"));

/**
 * Reverse one authenticated component reproducibility review transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220ComponentReproducibilityReviewClosureUpdate
	= (source, update) => {
		assert.ok(vo1220ComponentReproducibilityReviewClosureNormalizationPaths
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
 * Remove only the authenticated component reproducibility review closure.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ComponentReproducibilityReviewClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ComponentReproducibilityReviewClosureNormalizationPaths
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
			current = reverseVo1220ComponentReproducibilityReviewClosureUpdate(
				current, update);
	}
	return current;
};
