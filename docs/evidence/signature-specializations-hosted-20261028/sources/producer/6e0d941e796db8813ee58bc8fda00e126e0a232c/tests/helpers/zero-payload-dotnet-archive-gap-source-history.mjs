/**
 * Restore the zero-payload .NET archiver transition from c5a8723, which no
 * history record carried. That commit changed only this archiver script.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadDotnetArchiveGapHistoryPath
	= "docs/evidence/zero-payload-dotnet-archive-gap-source-history-20261024.json";
export const zeroPayloadDotnetArchiveGapPredecessor
	= "af8232b140605a598b128fdea9562649a8ba94d5";
export const zeroPayloadDotnetArchiveGapHistoricalPredecessor
	= "60412850d9ecc85cddcf271dd6d15884e370ca40";
export const zeroPayloadDotnetArchiveGapHistoricalCommit
	= "c5a8723cd1baa801ae10807df698578997401f66";
export const zeroPayloadDotnetArchiveGapHistoricalPaths = Object.freeze([
	"scripts/archive-zero-payload-checked-record-dotnet-evidence.mjs"
]);
export const zeroPayloadDotnetArchiveGapNormalizationPaths
	= zeroPayloadDotnetArchiveGapHistoricalPaths;
export const zeroPayloadDotnetArchiveGapAddedPaths = Object.freeze([
	"scripts/update-zero-payload-dotnet-archive-gap-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-archive-gap-source-history-tests.mjs"
	, "tests/helpers/zero-payload-dotnet-archive-gap-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadDotnetArchiveGapHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseZeroPayloadDotnetArchiveGapUpdate = (source, update) => {
	assert.ok(zeroPayloadDotnetArchiveGapNormalizationPaths.includes(update.path));
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
 * Remove the recognized omitted historical transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeZeroPayloadDotnetArchiveGapSource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !zeroPayloadDotnetArchiveGapNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	const update = record().historicalTransitions
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseZeroPayloadDotnetArchiveGapUpdate(source, update);
};
