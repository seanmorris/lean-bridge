/**
 * Authenticate the residual repairs found after the second complete hosted
 * Core run as one exact, reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreThirdRunResidualRepairHistoryPath
	= "docs/evidence/core-third-run-residual-repair-source-history-20261019.json";
export const coreThirdRunResidualRepairPredecessor
	= "37aa16e249564b181e626f268e5c4920f8e2b467";
export const coreThirdRunResidualRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/browser-generic-promotion-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-native-ci-report.mjs"
	, "tests/helpers/fin-python-ruby-promotion-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/generic-record-npm-closure-tests.mjs"
	, "tests/helpers/inherited-record-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-ruby-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-rust-evidence.mjs"
	, "tests/helpers/ruby-source-history.mjs"
]);
export const coreThirdRunResidualRepairAddedPaths = Object.freeze([
	"scripts/update-core-third-run-residual-repair-source-history.mjs"
	, "tests/helpers/core-third-run-residual-repair-source-history-tests.mjs"
	, "tests/helpers/core-third-run-residual-repair-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	coreThirdRunResidualRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact residual-repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCoreThirdRunResidualRepairUpdate = (source, update) => {
	assert.ok(coreThirdRunResidualRepairChangedPaths.includes(update.path));
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
 * Remove only the exact third residual-repair layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCoreThirdRunResidualRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreThirdRunResidualRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCoreThirdRunResidualRepairUpdate(source, update)
		: source;
};
