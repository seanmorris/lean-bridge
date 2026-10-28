/**
 * Authenticate the twelve-way Core partition that bounds exposure to hosted
 * runner shutdowns without weakening the contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreRunnerResilienceHistoryPath
	= "docs/evidence/core-runner-resilience-source-history-20261026.json";
export const coreRunnerResiliencePredecessor
	= "a60d56145aec317887426f8b4c6d43c2232d9e5d";
export const coreRunnerResilienceImplementation
	= "810c8fe089bd26e997fb45424f15665eaf7d98c5";
export const coreRunnerResilienceIntegrationBase
	= coreRunnerResilienceImplementation;
export const coreRunnerResilienceCommits = Object.freeze([
	"e80a4ce601320cbf8ba131ff6a55eb8452d4af3c"
	, "03046a24dc4d026179f01fcca02dd228467b1d06"
	, coreRunnerResilienceImplementation
]);
export const coreRunnerResilienceChangedPaths = Object.freeze([
	".github/workflows/quality.yml"
	, "docs/type-surface.v1.json"
	, "scripts/core-contract-shards.mjs"
	, "scripts/run-test-profile.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/core-quality-budget-tests.mjs"
]);
export const coreRunnerResilienceImplementationPaths
	= coreRunnerResilienceChangedPaths;
export const coreRunnerResilienceIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreRunnerResilienceNormalizationPaths = Object.freeze([
	...coreRunnerResilienceChangedPaths
	, ...coreRunnerResilienceIntegrationPaths
]);
export const coreRunnerResilienceAddedPaths = Object.freeze([
	"scripts/update-core-runner-resilience-source-history.mjs"
	, "tests/helpers/core-runner-resilience-source-history-tests.mjs"
	, "tests/helpers/core-runner-resilience-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreRunnerResilienceHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreRunnerResilienceUpdate = (source, update) => {
	assert.ok(coreRunnerResilienceNormalizationPaths.includes(update.path));
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
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated Core runner-resilience transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreRunnerResilienceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreRunnerResilienceNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreRunnerResilienceUpdate(current, update);
	}
	return current;
};
