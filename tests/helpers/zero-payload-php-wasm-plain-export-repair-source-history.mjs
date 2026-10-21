/**
 * Reverse the plain-export guard in the zero-payload PHP-Wasm compiler probe.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadPhpWasmPlainExportRepairHistoryPath
	= "docs/evidence/zero-payload-php-wasm-plain-export-repair-source-history-20261021.json";
export const zeroPayloadPhpWasmPlainExportRepairPredecessor
	= "7ed17799355ddaa53a00d4cd79516999e03129e9";
export const zeroPayloadPhpWasmPlainExportRepairImplementation
	= "1cbcba15dbc194a073f0b76de840bc4499bc89f0";
export const zeroPayloadPhpWasmPlainExportRepairChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-php-wasm-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-php-wasm-lean-tests.mjs"
]);
export const zeroPayloadPhpWasmPlainExportRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/zero-payload-checked-record-php-wasm.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadPhpWasmPlainExportRepairHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact repair transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadPhpWasmPlainExportRepairUpdate = (
	source, update
) => {
	assert.ok([...zeroPayloadPhpWasmPlainExportRepairChangedPaths
		, ...zeroPayloadPhpWasmPlainExportRepairIntegrationPaths]
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only this repair from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadPhpWasmPlainExportRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadPhpWasmPlainExportRepairChangedPaths
			, ...zeroPayloadPhpWasmPlainExportRepairIntegrationPaths]
			.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadPhpWasmPlainExportRepairUpdate(source, update)
		: source;
};
