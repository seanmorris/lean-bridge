/**
 * Reverse the stable-author-input .NET verifier repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadDotnetVerifierRepairHistoryPath
	= "docs/evidence/zero-payload-dotnet-verifier-repair-source-history-20261021.json";
export const zeroPayloadDotnetVerifierRepairPredecessor
	= "548cad1fdb2104b5feaec42b1aec380e73ed642a";
export const zeroPayloadDotnetVerifierRepairImplementation
	= "2aee414da1b93b5f8c235296589fe4cd48e952b5";
export const zeroPayloadDotnetVerifierRepairChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-dotnet-ci-report.mjs"
	, "tests/helpers/zero-payload-dotnet-ci-source-history-tests.mjs"
	, "tests/zero-payload-checked-record-dotnet.test.mjs"
]);
export const zeroPayloadDotnetVerifierRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadDotnetVerifierRepairHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact repair update.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadDotnetVerifierRepairUpdate = (
	source, update
) => {
	assert.ok([...zeroPayloadDotnetVerifierRepairChangedPaths
		, ...zeroPayloadDotnetVerifierRepairIntegrationPaths]
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this verifier repair from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadDotnetVerifierRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadDotnetVerifierRepairChangedPaths
			, ...zeroPayloadDotnetVerifierRepairIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadDotnetVerifierRepairUpdate(source, update)
		: source;
};
