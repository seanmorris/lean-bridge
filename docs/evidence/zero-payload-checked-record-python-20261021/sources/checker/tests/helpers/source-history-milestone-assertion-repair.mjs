/**
 * Authenticate the source-history milestone assertion repair as one exact,
 * reversible transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const sourceHistoryMilestoneAssertionRepairHistoryPath
	= "docs/evidence/source-history-milestone-assertion-repair-20261018.json";
export const sourceHistoryMilestoneAssertionRepairPredecessor
	= "d020b25aeabdad516b9dd23912a0bd90dc2d20fe";
export const sourceHistoryMilestoneAssertionRepairDraftParent
	= "f8cb2d4e9952a3fe3bc7faeb71a073dc534c1524";
export const sourceHistoryMilestoneAssertionRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/checked-record-value-index-foundation-source-history-tests.mjs"
	, "tests/helpers/core-quality-sharding-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/value-index-browser-lint-source-history-tests.mjs"
	, "tests/helpers/value-index-core-lineage-repair-source-history-tests.mjs"
]);
export const sourceHistoryMilestoneAssertionRepairFoundationPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-foundation-source-history-tests.mjs"
		, "tests/helpers/core-quality-sharding-source-history-tests.mjs"
		, "tests/helpers/value-index-browser-lint-source-history-tests.mjs"
		, "tests/helpers/value-index-core-lineage-repair-source-history-tests.mjs"
	]);
export const sourceHistoryMilestoneAssertionRepairAddedPaths = Object.freeze([
	"scripts/update-source-history-milestone-assertion-repair.mjs"
	, "tests/helpers/source-history-milestone-assertion-repair-tests.mjs"
	, "tests/helpers/source-history-milestone-assertion-repair.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	sourceHistoryMilestoneAssertionRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact source-history assertion transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseSourceHistoryMilestoneAssertionRepairUpdate = (
	source, update
) => {
	assert.ok(sourceHistoryMilestoneAssertionRepairChangedPaths.includes(
		update.path
	));
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
 * Remove only the exact source-history assertion repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeSourceHistoryMilestoneAssertionRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !sourceHistoryMilestoneAssertionRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseSourceHistoryMilestoneAssertionRepairUpdate(source, update)
		: source;
};
