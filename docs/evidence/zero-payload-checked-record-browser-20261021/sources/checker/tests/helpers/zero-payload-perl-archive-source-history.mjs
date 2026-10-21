/**
 * Reverse the zero-payload Perl verifier and archiver milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadPerlArchiveHistoryPath
	= "docs/evidence/zero-payload-perl-archive-source-history-20261021.json";
export const zeroPayloadPerlArchivePredecessor
	= "e44ddd16e9c1f05b7cff795c80dc679de1aeae00";
export const zeroPayloadPerlArchiveImplementation
	= "58e67660dcc3050d969fdf67a689698d83577ec8";
export const zeroPayloadPerlArchiveChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources.mjs"
	, "tests/zero-payload-checked-record-perl.test.mjs"
]);
export const zeroPayloadPerlArchiveIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadPerlArchiveHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact verifier/archiver update.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadPerlArchiveUpdate = (source, update) => {
	assert.ok([...zeroPayloadPerlArchiveChangedPaths
		, ...zeroPayloadPerlArchiveIntegrationPaths].includes(update.path));
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
 * Remove only this Perl archive milestone from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadPerlArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadPerlArchiveChangedPaths
			, ...zeroPayloadPerlArchiveIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadPerlArchiveUpdate(source, update)
		: source;
};
