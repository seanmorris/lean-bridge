/**
 * Reverse the zero-payload .NET verifier and archiver milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadDotnetArchiveHistoryPath
	= "docs/evidence/zero-payload-dotnet-archive-source-history-20261021.json";
export const zeroPayloadDotnetArchivePredecessor
	= "e71b69bed3a79b0c3131ee27fd71212f99841bae";
export const zeroPayloadDotnetArchiveImplementation
	= "79e7614713184f82fcb90f25d6d9a702e0ed0c0b";
export const zeroPayloadDotnetArchiveChangedPaths = Object.freeze([
	"scripts/check-zero-payload-checked-record-dotnet-ci.mjs"
	, "tests/helpers/zero-payload-checked-record-dotnet-ci-report.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources.mjs"
	, "tests/helpers/zero-payload-checked-record-native-ci-report.mjs"
	, "tests/zero-payload-checked-record-dotnet.test.mjs"
]);
export const zeroPayloadDotnetArchiveIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadDotnetArchiveHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact verifier/archiver update.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadDotnetArchiveUpdate = (source, update) => {
	assert.ok([...zeroPayloadDotnetArchiveChangedPaths
		, ...zeroPayloadDotnetArchiveIntegrationPaths].includes(update.path));
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
 * Remove only this .NET archive milestone from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadDotnetArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadDotnetArchiveChangedPaths
			, ...zeroPayloadDotnetArchiveIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadDotnetArchiveUpdate(source, update)
		: source;
};
