/**
 * Reverse the zero-payload Rust verifier and archiver milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadRustArchiveHistoryPath
	= "docs/evidence/zero-payload-rust-archive-source-history-20261021.json";
export const zeroPayloadRustArchivePredecessor
	= "073f490bdb039ae62368e639ea14e3728cec12cb";
export const zeroPayloadRustArchiveImplementation
	= "fb9040cc51face2caa0d32179b95942420db6e27";
export const zeroPayloadRustArchiveChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources.mjs"
	, "tests/zero-payload-checked-record-rust.test.mjs"
]);
export const zeroPayloadRustArchiveIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadRustArchiveHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact verifier/archiver update.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadRustArchiveUpdate = (source, update) => {
	assert.ok([...zeroPayloadRustArchiveChangedPaths
		, ...zeroPayloadRustArchiveIntegrationPaths].includes(update.path));
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
 * Remove only this Rust archive milestone from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadRustArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadRustArchiveChangedPaths
			, ...zeroPayloadRustArchiveIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadRustArchiveUpdate(source, update)
		: source;
};
