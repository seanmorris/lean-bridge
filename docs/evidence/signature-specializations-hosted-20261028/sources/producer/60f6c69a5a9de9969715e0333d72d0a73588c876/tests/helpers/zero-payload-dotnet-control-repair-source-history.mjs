/**
 * Reverse the zero-payload .NET package-control diagnostic repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadDotnetControlRepairHistoryPath
	= "docs/evidence/zero-payload-dotnet-control-repair-source-history-20261021.json";
export const zeroPayloadDotnetControlRepairPredecessor
	= "e2971f3094a4d3b82d253c0d01082e26334beae6";
export const zeroPayloadDotnetControlRepairImplementation
	= "dc4eec50968994140aeed524cbcbe13a76327bec";
export const zeroPayloadDotnetControlRepairChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-dotnet-controls.mjs"
	, "tests/zero-payload-checked-record-dotnet.test.mjs"
]);
export const zeroPayloadDotnetControlRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadDotnetControlRepairHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact control repair.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadDotnetControlRepairUpdate = (
	source, update
) => {
	assert.ok([...zeroPayloadDotnetControlRepairChangedPaths
		, ...zeroPayloadDotnetControlRepairIntegrationPaths]
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
 * Remove only this package-control repair from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadDotnetControlRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadDotnetControlRepairChangedPaths
			, ...zeroPayloadDotnetControlRepairIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadDotnetControlRepairUpdate(source, update)
		: source;
};
