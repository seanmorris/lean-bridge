/**
 * Reverse the shared zero-payload hosted-archive preparation milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadHostedArchivePreparationHistoryPath
	= "docs/evidence/zero-payload-hosted-archive-preparation-source-history-20261021.json";
export const zeroPayloadHostedArchivePreparationPredecessor
	= "1765ca68ffc8b101b6de8752060a804b94b3e2d5";
export const zeroPayloadHostedArchivePreparationImplementation
	= "a79ff3093284b536ed6e7b5f7074370091b67e7c";
export const zeroPayloadHostedArchivePreparationChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources.mjs"
	, "tests/zero-payload-checked-records.test.mjs"
]);
export const zeroPayloadHostedArchivePreparationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadHostedArchivePreparationHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact archive-preparation update.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadHostedArchivePreparationUpdate = (
	source, update
) => {
	assert.ok([...zeroPayloadHostedArchivePreparationChangedPaths
		, ...zeroPayloadHostedArchivePreparationIntegrationPaths]
		.includes(update.path));
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
 * Remove only this shared archive-preparation milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadHostedArchivePreparationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadHostedArchivePreparationChangedPaths
			, ...zeroPayloadHostedArchivePreparationIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadHostedArchivePreparationUpdate(source, update)
		: source;
};
