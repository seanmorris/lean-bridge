/**
 * Preserve direct proof-erasure npm handoff archive retention and verification.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureNpmArchiveHistoryPath
	= "docs/evidence/direct-proof-erasure-npm-archive-source-history-20261028.json";
export const directProofErasureNpmArchivePredecessor
	= "83017aaa62e6b68526da64204cdb43800287ce75";
export const directProofErasureNpmArchiveImplementation
	= "dee53b51d0889e44c2875c0f25dc94a1b9ad3d5b";
export const directProofErasureNpmArchiveImplementationPaths = Object.freeze([
	"tests/direct-proof-erasure-npm-installed.test.mjs"
	, "tests/helpers/direct-proof-erasure-browser-tests.mjs"
	, "tests/helpers/direct-proof-erasure-npm-report.mjs"
]);
export const directProofErasureNpmArchiveIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const directProofErasureNpmArchiveNormalizationPaths = Object.freeze([
	...directProofErasureNpmArchiveImplementationPaths
	, ...directProofErasureNpmArchiveIntegrationPaths
]);
export const directProofErasureNpmArchiveAddedPaths = Object.freeze([
	"scripts/update-direct-proof-erasure-npm-archive-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-npm-archive-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-npm-archive-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureNpmArchiveHistoryPath, "utf8"
));

/**
 * Reverse one exact npm archive-retention transition.
 *
 * @param source - Complete current source.
 * @param update - Path, digests and current-side edits.
 */
export const reverseDirectProofErasureNpmArchiveUpdate = (source, update) => {
	assert.ok(directProofErasureNpmArchiveNormalizationPaths
		.includes(update.path));
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove recognized npm archive-retention transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureNpmArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureNpmArchiveNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDirectProofErasureNpmArchiveUpdate(current, update);
	}
	return current;
};
