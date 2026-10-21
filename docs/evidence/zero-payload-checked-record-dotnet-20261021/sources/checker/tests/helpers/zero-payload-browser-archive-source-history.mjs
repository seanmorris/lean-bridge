/**
 * Reverse the authenticated zero-payload browser archive-tooling milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadBrowserArchiveHistoryPath
	= "docs/evidence/zero-payload-browser-archive-source-history-20261021.json";
export const zeroPayloadBrowserArchivePredecessor
	= "5667a26826838580efaf9abec9947501610c90a4";
export const zeroPayloadBrowserArchiveImplementation
	= "fc3dd94d5fad6da6030585cfe140dae9bb15abca";
export const zeroPayloadBrowserArchiveChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-browser-ci-source-history-tests.mjs"
	, "tests/zero-payload-checked-record-javascript.test.mjs"
]);
export const zeroPayloadBrowserArchiveIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadBrowserArchiveHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadBrowserArchiveUpdate = (source, update) => {
	assert.ok([...zeroPayloadBrowserArchiveChangedPaths
		, ...zeroPayloadBrowserArchiveIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this exact zero-payload browser archive-tooling milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadBrowserArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || ![...zeroPayloadBrowserArchiveChangedPaths
		, ...zeroPayloadBrowserArchiveIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadBrowserArchiveUpdate(source, update)
		: source;
};
