/**
 * Preserve the exact-head historical replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreExactHeadReplayRepairHistoryPath
	= "docs/evidence/core-exact-head-replay-repair-source-history-20261027.json";
export const coreExactHeadReplayRepairPredecessor
	= "ed3a0cbbdd1138f4365795cae17d56bba9f31d51";
export const coreExactHeadReplayRepairImplementation
	= "a2b04e87687437395de1362f3d4504eed1115b15";
export const coreExactHeadReplayRepairImplementationPaths = Object.freeze([
	"tests/helpers/bounded-recurring-acceptance-sweep-source-history.mjs"
	, "tests/helpers/core-exact-head-validation-repair-source-history.mjs"
	, "tests/helpers/core-quality-budget-tests.mjs"
	, "tests/helpers/cpp-fin-dispatch-integration-tests.mjs"
	, "tests/helpers/default-branch-ci-trigger-budget-source-history.mjs"
	, "tests/helpers/fin-container-evidence-ci-tests.mjs"
	, "tests/helpers/fin-entry-integration-tests.mjs"
	, "tests/helpers/perl-closure-native-budget-tests.mjs"
	, "tests/helpers/recurring-acceptance-documentation-source-history.mjs"
	, "tests/helpers/reviewed-fin-refusal-ci-tests.mjs"
	, "tests/helpers/source-at-fin-history-milestone.mjs"
	, "tests/helpers/zero-payload-php-wasm-source-history-tests.mjs"
	, "tests/helpers/zero-payload-php-wasm-source-history.mjs"
	, "tests/hosted-container-inventory.test.mjs"
	, "tests/native-edge-array-harness-history.test.mjs"
	, "tests/perl-relocated-promotion.test.mjs"
	, "tests/reviewed-fin-refusal-history.test.mjs"
	, "tests/wasm-ci-array-history.test.mjs"
	, "tests/wasm-entry-archive-history.test.mjs"
	, "tests/wasm-entry-controls-history.test.mjs"
	, "tests/wasm-entry-harness-history.test.mjs"
]);
export const coreExactHeadReplayRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreExactHeadReplayRepairHistoryAdditions = Object.freeze([
	"scripts/update-core-exact-head-replay-repair-source-history.mjs"
	, "tests/helpers/core-exact-head-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${coreExactHeadReplayRepairHistoryPath}`
		, import.meta.url), "utf8"
));

/** List every source whose current bytes participate in this transition. */
export const coreExactHeadReplayRepairNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	coreExactHeadReplayRepairImplementationPaths.includes(path)
	|| coreExactHeadReplayRepairIntegrationPaths.includes(path);

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreExactHeadReplayRepairUpdate = (source, update) => {
	assert.ok(allowedTransitionPath(update.path), update.path);
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
 * Remove only the authenticated exact-head replay repair transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreExactHeadReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	if(!updates.some(update => update.path === path)) return source;
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreExactHeadReplayRepairUpdate(current, update);
	}
	return current;
};
