/**
 * Reverse the zero-payload Rust CI acceptance milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadRustCiHistoryPath
	= "docs/evidence/zero-payload-rust-ci-source-history-20261021.json";
export const zeroPayloadRustCiPredecessor
	= "62359d47252ee76a6ad0b679e78c37f5e6a5f510";
export const zeroPayloadRustCiImplementation
	= "62232f6f012fe644590439a46dbc37af25550589";
export const zeroPayloadRustCiChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-rust-installed-tests.mjs"
	, "tests/zero-payload-checked-record-rust.test.mjs"
]);
export const zeroPayloadRustCiIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadRustCiHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact hosted-CI update.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadRustCiUpdate = (source, update) => {
	assert.ok([...zeroPayloadRustCiChangedPaths
		, ...zeroPayloadRustCiIntegrationPaths].includes(update.path));
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
 * Remove only this Rust CI milestone from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadRustCiSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadRustCiChangedPaths
			, ...zeroPayloadRustCiIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadRustCiUpdate(source, update)
		: source;
};
