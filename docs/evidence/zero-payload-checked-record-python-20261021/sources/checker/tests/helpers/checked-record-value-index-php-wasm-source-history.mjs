/**
 * Authenticate the complete delayed PHP-Wasm value-index lineage and its
 * current source-history registration without rewriting any earlier commit.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPhpWasmHistoryPath
	= "docs/evidence/checked-record-value-index-php-wasm-source-history-20261020.json";
export const checkedRecordValueIndexPhpWasmRegistrationParent
	= "2f978936d0e503b7750057a1299cf495834787ee";
export const checkedRecordValueIndexPhpWasmTransitions = Object.freeze([
	Object.freeze({
		name: "source-contract"
		, previousCommit: "b981260bb6fe3335492e2c902c144824e2ae10b9"
		, currentCommit: "2acbc600ea919724dc30712c64b0983941f31cd8"
		, modifiedPaths: Object.freeze([
			"tests/checked-record-php-wasm-foundation.test.mjs"
		])
		, addedPaths: Object.freeze([
			"tests/helpers/checked-record-value-index-php-wasm-fixture-tests.mjs"
			, "tests/helpers/checked-record-value-index-php-wasm-fixture.mjs"
		])
	})
	, Object.freeze({
		name: "compiler-controls"
		, previousCommit: "7b5fa5f4eb095fa9636bb5f4a8b2287bef47bbd3"
		, currentCommit: "e63c29988da07a5ab2925b45dc4465a140aeee49"
		, modifiedPaths: Object.freeze([
			"src/adoption/test-profiles.mjs"
			, "tests/checked-record-php-wasm-foundation.test.mjs"
			, "tests/helpers/core-quality-budget-tests.mjs"
		])
		, addedPaths: Object.freeze([
			"tests/checked-record-value-index-php-wasm.test.mjs"
			, "tests/helpers/checked-record-value-index-php-wasm-lean-tests.mjs"
		])
	})
	, Object.freeze({
		name: "installed-acceptance"
		, previousCommit: "e63c29988da07a5ab2925b45dc4465a140aeee49"
		, currentCommit: "2ad8485f3ada7e419cad47c5f426a8a30537b2da"
		, modifiedPaths: Object.freeze([
			"tests/checked-record-value-index-php-wasm.test.mjs"
			, "tests/helpers/core-quality-budget-tests.mjs"
		])
		, addedPaths: Object.freeze([
			".github/workflows/checked-record-value-index-php-wasm.yml"
			, "scripts/check-checked-record-value-index-php-wasm-ci.mjs"
			, "scripts/check-checked-record-value-index-php-wasm-compiler-ci.mjs"
			, "scripts/run-checked-record-value-index-php-wasm-ci.sh"
			, "tests/helpers/checked-record-value-index-php-wasm-ci-report-tests.mjs"
			, "tests/helpers/checked-record-value-index-php-wasm-ci-report.mjs"
			, "tests/helpers/checked-record-value-index-php-wasm-ci-shell-tests.mjs"
			, "tests/helpers/checked-record-value-index-php-wasm-ci-workflow-tests.mjs"
			, "tests/helpers/checked-record-value-index-php-wasm-ci-workflow.mjs"
			, "tests/helpers/checked-record-value-index-php-wasm-installed-tests.mjs"
			, "tests/helpers/checked-record-value-index-php-wasm-report.mjs"
		])
	})
	, Object.freeze({
		name: "package-closure"
		, previousCommit: "4060e1c6eaea9d7ebcef15d57cdf98b7f5a7b81b"
		, currentCommit: "aba3628faa93b71ff30f91157f47fd6a05534555"
		, modifiedPaths: Object.freeze([
			"tests/helpers/checked-record-value-index-php-wasm-ci-report-tests.mjs"
			, "tests/helpers/checked-record-value-index-php-wasm-installed-tests.mjs"
			, "tests/helpers/checked-record-value-index-php-wasm-report.mjs"
		])
		, addedPaths: Object.freeze([])
	})
]);
export const checkedRecordValueIndexPhpWasmRegistrationPaths = Object.freeze([
	"tests/checked-record-value-index-php-wasm.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexPhpWasmHistoricalPaths = Object.freeze([
	...new Set(checkedRecordValueIndexPhpWasmTransitions.flatMap(
		transition => transition.modifiedPaths
	))
]);
export const checkedRecordValueIndexPhpWasmChangedPaths = Object.freeze([
	...new Set([
		...checkedRecordValueIndexPhpWasmRegistrationPaths
		, ...checkedRecordValueIndexPhpWasmHistoricalPaths
	])
]);
export const checkedRecordValueIndexPhpWasmHistoryAddedPaths = Object.freeze([
	"scripts/update-checked-record-value-index-php-wasm-source-history.mjs"
	, "tests/helpers/checked-record-value-index-php-wasm-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-php-wasm-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPhpWasmHistoryPath, "utf8"
));

/**
 * Reverse one exact PHP-Wasm value-index source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexPhpWasmUpdate = (source, update) => {
	assert.ok(checkedRecordValueIndexPhpWasmChangedPaths.includes(update.path)
		, update.path);
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
 * Remove every immediately applicable PHP-Wasm value-index layer, stopping at
 * an explicitly requested authenticated digest when supplied.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexPhpWasmSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexPhpWasmChangedPaths.includes(path))
		return source;
	let previous = source;
	const updates = record().updates.filter(update => update.path === path);
	while(true)
	{
		const digest = sha256(previous);
		if(digest === expected) return previous;
		const update = updates.find(item => item.currentSha256 === digest);
		if(!update) return previous;
		previous = reverseCheckedRecordValueIndexPhpWasmUpdate(previous, update);
	}
};
