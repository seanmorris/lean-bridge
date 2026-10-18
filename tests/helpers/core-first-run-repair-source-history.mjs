/**
 * Authenticate the first complete hosted Core-run repairs as one exact,
 * reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreFirstRunRepairHistoryPath
	= "docs/evidence/core-first-run-repair-source-history-20261018.json";
export const coreFirstRunRepairPredecessor
	= "341d291ad09c72ca567c7519e919d1a514c74b21";
export const coreFirstRunRepairDraftParent
	= "1cb191848cc6ea010b5e448c3970fb9667447211";
export const coreFirstRunRepairFoundationPaths = Object.freeze([
	"src/analyze/reviewed-source.mjs"
	, "tests/helpers/ci-contract-repair-source-history.mjs"
	, "tests/helpers/generic-record-promotion-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-evidence-source-history-tests.mjs"
	, "tests/helpers/ruby-source-history.mjs"
	, "tests/perl-relocated-promotion.test.mjs"
	, "tests/ruby-collection-contract.test.mjs"
	, "tests/ruby-compound-contract.test.mjs"
	, "tests/ruby-variant-contract.test.mjs"
]);
export const coreFirstRunRepairAddedPaths = Object.freeze([
	"scripts/update-core-first-run-repair-source-history.mjs"
	, "tests/helpers/core-first-run-repair-source-history-tests.mjs"
	, "tests/helpers/core-first-run-repair-source-history.mjs"
]);
export const coreFirstRunRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/analyze/reviewed-source.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/ci-contract-repair-source-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/generic-record-promotion-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-evidence-source-history-tests.mjs"
	, "tests/helpers/ruby-source-history.mjs"
	, "tests/perl-relocated-promotion.test.mjs"
	, "tests/ruby-collection-contract.test.mjs"
	, "tests/ruby-compound-contract.test.mjs"
	, "tests/ruby-variant-contract.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	coreFirstRunRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact first-run repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCoreFirstRunRepairUpdate = (source, update) => {
	assert.ok(coreFirstRunRepairChangedPaths.includes(update.path));
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
 * Remove only the exact first complete Core-run repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCoreFirstRunRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !coreFirstRunRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCoreFirstRunRepairUpdate(source, update)
		: source;
};
