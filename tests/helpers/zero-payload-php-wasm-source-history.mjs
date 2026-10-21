/**
 * Reverse the authenticated zero-payload PHP-Wasm package source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadPhpWasmHistoryHistoryPath
	= "docs/evidence/zero-payload-php-wasm-source-history-20261021.json";
export const zeroPayloadPhpWasmHistoryPredecessor
	= "cdfada7eb7035d2f596d1ceeab1c5b27a6c2df53";
export const zeroPayloadPhpWasmHistoryImplementation
	= "6c77258032767ebdb1cd5226be0bd5ca59360915";
export const zeroPayloadPhpWasmHistoryChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/zero-payload-checked-record-php-wasm.test.mjs"
]);
export const zeroPayloadPhpWasmHistoryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const zeroPayloadPhpWasmHistoryApplicationPaths = Object.freeze([
	".github/workflows/zero-payload-checked-record-php-wasm.yml"
	, "scripts/check-zero-payload-checked-record-php-wasm-ci.mjs"
	, "scripts/check-zero-payload-checked-record-php-wasm-compiler-ci.mjs"
	, "scripts/run-zero-payload-checked-record-php-wasm-ci.sh"
	, "tests/helpers/zero-payload-checked-record-php-wasm-ci-report-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-ci-report.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-ci-shell-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-ci-workflow-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-ci-workflow.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-installed-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-lean-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-report.mjs"
	, "tests/zero-payload-checked-record-php-wasm.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadPhpWasmHistoryHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadPhpWasmHistoryUpdate = (source, update) => {
	assert.ok([...zeroPayloadPhpWasmHistoryChangedPaths
		, ...zeroPayloadPhpWasmHistoryIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
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
 * Remove only this exact zero-payload PHP-Wasm milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadPhpWasmHistorySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadPhpWasmHistoryChangedPaths
			, ...zeroPayloadPhpWasmHistoryIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadPhpWasmHistoryUpdate(source, update)
		: source;
};
