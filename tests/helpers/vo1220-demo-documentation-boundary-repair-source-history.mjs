/**
 * Preserve the demo documentation boundary repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220DemoDocumentationBoundaryRepairHistoryPath
	= "docs/evidence/vo1220-demo-documentation-boundary-repair-source-history-20261112.json";
export const vo1220DemoDocumentationBoundaryRepairPredecessor
	= "60afe5b7f28d1093403554a4d0cd64c799cab55b";
export const vo1220DemoDocumentationBoundaryRepairImplementation
	= "938725363f63bab25be28b65de10aa1d243e9eae";
export const vo1220DemoDocumentationBoundaryRepairImplementationPaths
	= Object.freeze([
		".github/workflows/demos-pages.yml", "package.json"
		, "tests/documentation-demo-api.test.mjs"
		, "tests/documentation.test.mjs"
		, "tests/lean-author-documentation.test.mjs"
		, "tests/reference-documentation.test.mjs"
	]);
export const vo1220DemoDocumentationBoundaryRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220DemoDocumentationBoundaryRepairAddedPaths
	= Object.freeze([
		"scripts/update-vo1220-demo-documentation-boundary-repair-source-history.mjs"
		, "tests/helpers/vo1220-demo-documentation-boundary-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-demo-documentation-boundary-repair-source-history.mjs"
	]);
export const vo1220DemoDocumentationBoundaryRepairNormalizationPaths
	= Object.freeze([
		...vo1220DemoDocumentationBoundaryRepairImplementationPaths
		, ...vo1220DemoDocumentationBoundaryRepairIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220DemoDocumentationBoundaryRepairHistoryPath, "utf8"));

/**
 * Reverse one authenticated demo documentation boundary transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220DemoDocumentationBoundaryRepairUpdate
	= (source, update) => {
		assert.ok(vo1220DemoDocumentationBoundaryRepairNormalizationPaths
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
 * Remove only the authenticated demo documentation boundary repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220DemoDocumentationBoundaryRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220DemoDocumentationBoundaryRepairNormalizationPaths
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
			current = reverseVo1220DemoDocumentationBoundaryRepairUpdate(
				current, update);
	}
	return current;
};
