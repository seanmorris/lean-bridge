/**
 * Reverse the zero-payload Rust installed acceptance milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadRustInstalledHistoryPath
	= "docs/evidence/zero-payload-rust-installed-source-history-20261021.json";
export const zeroPayloadRustInstalledPredecessor
	= "870b23d4306bf9a5c105f6c199d5cb9dd157c865";
export const zeroPayloadRustInstalledImplementation
	= "b76cc501ff5c3242f7f3fa2ebfe9a07cd633af7b";
export const zeroPayloadRustInstalledChangedPaths = Object.freeze([
	"tests/zero-payload-checked-record-rust.test.mjs"
]);
export const zeroPayloadRustInstalledIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadRustInstalledHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact installed-acceptance update.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadRustInstalledUpdate = (source, update) => {
	assert.ok([...zeroPayloadRustInstalledChangedPaths
		, ...zeroPayloadRustInstalledIntegrationPaths].includes(update.path));
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
 * Remove only this Rust installed milestone from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadRustInstalledSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadRustInstalledChangedPaths
			, ...zeroPayloadRustInstalledIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadRustInstalledUpdate(source, update)
		: source;
};
