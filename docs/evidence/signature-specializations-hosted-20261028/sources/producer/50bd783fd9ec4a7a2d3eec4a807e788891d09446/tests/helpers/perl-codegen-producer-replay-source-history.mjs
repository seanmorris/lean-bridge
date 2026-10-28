/**
 * Reverse the Perl codegen producer replay: the structured codegen regression
 * regenerates its frozen fixtures with the recorded 8538d3f generator closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlCodegenProducerReplayHistoryPath
	= "docs/evidence/perl-codegen-producer-replay-source-history-20261028.json";
export const perlCodegenProducerReplayPredecessor
	= "4d16da9b53e25273ce1a75b7ce0dd0d15661b92c";
export const perlCodegenProducerReplayImplementation
	= "fc9077597e898133fef488f4173c8e1afdb11962";
export const perlCodegenProducerReplayCommits = Object.freeze([
	"fc9077597e898133fef488f4173c8e1afdb11962"
]);
export const perlCodegenProducerReplayChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/perl-structured-callable-evidence.mjs"
	, "tests/helpers/perl-structured-callable-regression.mjs"
	, "tests/perl-structured-callable-contract.test.mjs"
]);
export const perlCodegenProducerReplayNormalizationPaths
	= perlCodegenProducerReplayChangedPaths;
export const perlCodegenProducerReplayImplementationAddedPaths = Object.freeze([]);
export const perlCodegenProducerReplayHistoryAddedPaths = Object.freeze([
	"scripts/update-perl-codegen-producer-replay-source-history.mjs"
	, "tests/helpers/perl-codegen-producer-replay-source-history-tests.mjs"
	, "tests/helpers/perl-codegen-producer-replay-source-history.mjs"
]);
export const perlCodegenProducerReplayAddedPaths = Object.freeze([
	...perlCodegenProducerReplayImplementationAddedPaths
	, ...perlCodegenProducerReplayHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	perlCodegenProducerReplayHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reversePerlCodegenProducerReplayUpdate = (source, update) => {
	assert.ok(perlCodegenProducerReplayNormalizationPaths.includes(update.path));
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
 * Remove only this layer's recognized transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforePerlCodegenProducerReplaySource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !perlCodegenProducerReplayNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reversePerlCodegenProducerReplayUpdate(source, update);
};
