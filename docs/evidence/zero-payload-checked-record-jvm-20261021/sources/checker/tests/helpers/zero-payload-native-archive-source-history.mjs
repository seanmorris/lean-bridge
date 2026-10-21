/**
 * Reverse the zero-payload native archiver and hosted-backend follow-up.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadNativeArchiveHistoryPath
	= "docs/evidence/zero-payload-native-archive-source-history-20261021.json";
export const zeroPayloadNativeArchivePredecessor
	= "17de8ed392e65237636d4749e65247fa45d739be";
export const zeroPayloadNativeArchiveImplementation
	= "9faeb2ff217aa9caee2a7e388fc050b546c8fe93";
export const zeroPayloadNativeArchiveChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-hosted-evidence-sources.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-native-ci-report.mjs"
	, "tests/helpers/zero-payload-checked-record-native-installed-tests.mjs"
	, "tests/zero-payload-checked-records.test.mjs"
]);
export const zeroPayloadNativeArchiveIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadNativeArchiveHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadNativeArchiveUpdate = (source, update) => {
	assert.ok([...zeroPayloadNativeArchiveChangedPaths
		, ...zeroPayloadNativeArchiveIntegrationPaths].includes(update.path));
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
 * Remove only this exact zero-payload native archive milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadNativeArchiveSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...zeroPayloadNativeArchiveChangedPaths
		, ...zeroPayloadNativeArchiveIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadNativeArchiveUpdate(source, update)
		: source;
};
