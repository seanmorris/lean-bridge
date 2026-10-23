/**
 * Reverse the zero-payload PHP-Wasm archive milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadPhpWasmArchiveHistoryPath
	= "docs/evidence/zero-payload-php-wasm-archive-source-history-20261021.json";
export const zeroPayloadPhpWasmArchivePredecessor
	= "0e8b0f36182a5ae90bf47da2439faae3e3a60b49";
export const zeroPayloadPhpWasmArchiveImplementation
	= "40c21dc633390b376bf5ea0c91eb97163adfb159";
export const zeroPayloadPhpWasmArchiveChangedPaths = Object.freeze([
	"tests/zero-payload-checked-records.test.mjs"
]);
export const zeroPayloadPhpWasmArchiveIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadPhpWasmArchiveHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact archive transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadPhpWasmArchiveUpdate = (source, update) => {
	assert.ok([...zeroPayloadPhpWasmArchiveChangedPaths
		, ...zeroPayloadPhpWasmArchiveIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
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
 * Remove only this archive milestone from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadPhpWasmArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadPhpWasmArchiveChangedPaths
			, ...zeroPayloadPhpWasmArchiveIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadPhpWasmArchiveUpdate(source, update)
		: source;
};
