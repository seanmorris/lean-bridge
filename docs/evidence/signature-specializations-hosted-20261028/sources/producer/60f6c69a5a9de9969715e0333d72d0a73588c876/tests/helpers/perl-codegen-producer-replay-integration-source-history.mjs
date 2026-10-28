/**
 * Reverse central registration of the authenticated Perl codegen producer replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlCodegenProducerReplayIntegrationHistoryPath
	= "docs/evidence/perl-codegen-producer-replay-integration-source-history-20261028.json";
export const perlCodegenProducerReplayIntegrationBase
	= "2361a8121b1b3c264272eb89e353e74452535857";
export const perlCodegenProducerReplayIntegrationImplementation
	= "6e08b1e0bc3fe1fd1d0da3d07196ab6c99fe2438";
export const perlCodegenProducerReplayIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const perlCodegenProducerReplayIntegrationNormalizationPaths
	= perlCodegenProducerReplayIntegrationPaths;
export const perlCodegenProducerReplayIntegrationAddedPaths = Object.freeze([
	"scripts/update-perl-codegen-producer-replay-integration-source-history.mjs"
	, "tests/helpers/perl-codegen-producer-replay-integration-source-history-tests.mjs"
	, "tests/helpers/perl-codegen-producer-replay-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	perlCodegenProducerReplayIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reversePerlCodegenProducerReplayIntegrationUpdate = (
	source, update
) => {
	assert.ok(perlCodegenProducerReplayIntegrationPaths.includes(update.path));
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
 * Remove only this integration layer, stopping at an optional exact digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePerlCodegenProducerReplayIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !perlCodegenProducerReplayIntegrationPaths.includes(path)) return source;
	if(sha256(source) === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	return update === undefined ? source
		: reversePerlCodegenProducerReplayIntegrationUpdate(source, update);
};
