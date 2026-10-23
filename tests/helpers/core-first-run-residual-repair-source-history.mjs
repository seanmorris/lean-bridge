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
const recordPointerLayers = Object.freeze([
	Object.freeze({
		currentContainerSha256: "cb730ea6e649ab204029b862a75deaa2e4b9948ef06c43fd4c8d7b7def05c034"
		, current: "b8c33a3a21da3f38ed8647fc8984be7815ec8ca6b6be8f78b224136811c3ff7d"
		, previous: "dce5bd7367d8764c2b2f5a93a69baba56e724a5db623d033707d39bea24b547d"
		, previousContainerSha256: "c27ea39d9f5592a961009c252618390137a9d6085cdde36d4fa0820d7f453a2d"
	})
	, Object.freeze({
		currentContainerSha256: "c27ea39d9f5592a961009c252618390137a9d6085cdde36d4fa0820d7f453a2d"
		, current: "dce5bd7367d8764c2b2f5a93a69baba56e724a5db623d033707d39bea24b547d"
		, previous: "3331489dcab7a9b9dda3450440438c2444405a48009a086be465ca428c878b2f"
		, previousContainerSha256: "8c2eda9fbf01fef2c5ab7e6bbd8758a8f0441cf6f0ca022ffbd3dd388bee005e"
	})
]);

/** Restore the immutable repair ledger before interpreting its edit offsets. */
const originalRecordSource = () => {
	let source = readFileSync(coreFirstRunResidualRepairHistoryPath, "utf8");
	for(const layer of recordPointerLayers)
	{
		assert.equal(sha256(source), layer.currentContainerSha256
			, coreFirstRunResidualRepairHistoryPath);
		assert.equal(source.split(layer.current).length - 1, 1
			, coreFirstRunResidualRepairHistoryPath);
		source = source.replace(layer.current, layer.previous);
		assert.equal(sha256(source), layer.previousContainerSha256
			, coreFirstRunResidualRepairHistoryPath);
	}
	return source;
};

const record = () => history ??= JSON.parse(originalRecordSource());

/** Return an isolated copy of the authenticated original ledger. */
export const coreFirstRunResidualRepairRecord = () =>
	structuredClone(record());

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
