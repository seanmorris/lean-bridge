/**
 * Reverse the zero-payload .NET hosted verification milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadDotnetCiHistoryPath
	= "docs/evidence/zero-payload-dotnet-ci-source-history-20261021.json";
export const zeroPayloadDotnetCiPredecessor
	= "9d47c4c31dc77023126596cca276af05bbe02ddd";
export const zeroPayloadDotnetCiImplementation
	= "d91da29e99f0eb2708273ddb4a6f181102a46e10";
export const zeroPayloadDotnetCiChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-dotnet-source-history-tests.mjs"
	, "tests/zero-payload-checked-record-dotnet.test.mjs"
]);
export const zeroPayloadDotnetCiIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadDotnetCiHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact hosted-verification source update.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadDotnetCiUpdate = (source, update) => {
	assert.ok([...zeroPayloadDotnetCiChangedPaths
		, ...zeroPayloadDotnetCiIntegrationPaths].includes(update.path));
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
 * Remove only this hosted-verification milestone from one source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadDotnetCiSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...zeroPayloadDotnetCiChangedPaths
		, ...zeroPayloadDotnetCiIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadDotnetCiUpdate(source, update)
		: source;
};
