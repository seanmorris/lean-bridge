/**
 * Authenticate the residual repairs discovered by the first complete hosted
 * Core run as one exact, reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreFirstRunResidualRepairHistoryPath
	= "docs/evidence/core-first-run-residual-repair-source-history-20261019.json";
export const coreFirstRunResidualRepairPredecessor
	= "f5395d5762bc21ffbf255a627d878e791140ae71";
export const coreFirstRunResidualRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/checked-record-perl-promotion-tests.mjs"
	, "tests/helpers/component-nominal-subtype-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/fin-scalar-dispatch-inventory.mjs"
	, "tests/helpers/inherited-record-archive-source-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-promotion-tests.mjs"
	, "tests/helpers/structural-subtype-entry-report.mjs"
	, "tests/helpers/structural-subtype-promotion-tests.mjs"
	, "tests/inherited-checked-record-php-source-history.test.mjs"
	, "tests/perl-scalar-promotion.test.mjs"
	, "tests/php-collection-evidence.test.mjs"
	, "tests/recursive-wit-test-registration-history.test.mjs"
	, "tests/ruby-copied-graph-values.test.mjs"
	, "tests/wasm-entry-supplement-history.test.mjs"
]);
export const coreFirstRunResidualRepairAddedPaths = Object.freeze([
	"scripts/update-core-first-run-residual-repair-source-history.mjs"
	, "tests/helpers/core-first-run-residual-repair-source-history-tests.mjs"
	, "tests/helpers/core-first-run-residual-repair-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	coreFirstRunResidualRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact residual-repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCoreFirstRunResidualRepairUpdate = (source, update) => {
	assert.ok(coreFirstRunResidualRepairChangedPaths.includes(update.path));
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
 * Remove only the exact residual-repair layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreFirstRunResidualRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreFirstRunResidualRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCoreFirstRunResidualRepairUpdate(source, update)
		: source;
};
