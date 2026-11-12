/**
 * Preserve the demo job retained-contract scope repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220DemoJobScopeRepairHistoryPath
	= "docs/evidence/vo1220-demo-job-scope-repair-source-history-20261112.json";
export const vo1220DemoJobScopeRepairPredecessor
	= "fc5cbe7482d1e6c68a06cd4a9651fddda7b7760f";
export const vo1220DemoJobScopeRepairImplementation
	= "d9460ac2d2a1768ecd4b51a036c8fa6f6b773fa8";
export const vo1220DemoJobScopeRepairImplementationPaths = Object.freeze([
	".github/workflows/demos-pages.yml"
	, "tests/documentation-demo-api.test.mjs"
]);
export const vo1220DemoJobScopeRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220DemoJobScopeRepairAddedPaths = Object.freeze([
	"scripts/update-vo1220-demo-job-scope-repair-source-history.mjs"
	, "tests/helpers/vo1220-demo-job-scope-repair-source-history-tests.mjs"
	, "tests/helpers/vo1220-demo-job-scope-repair-source-history.mjs"
]);
export const vo1220DemoJobScopeRepairNormalizationPaths = Object.freeze([
	...vo1220DemoJobScopeRepairImplementationPaths
	, ...vo1220DemoJobScopeRepairIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220DemoJobScopeRepairHistoryPath, "utf8"));

/**
 * Reverse one authenticated demo job-scope transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220DemoJobScopeRepairUpdate = (source, update) => {
	assert.ok(vo1220DemoJobScopeRepairNormalizationPaths
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
 * Remove only the authenticated demo job-scope repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220DemoJobScopeRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220DemoJobScopeRepairNormalizationPaths.includes(path))
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
			current = reverseVo1220DemoJobScopeRepairUpdate(current, update);
	}
	return current;
};
