/**
 * Reverse local integration of the merged Perl codegen replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlCodegenMergedIntegrationHistoryPath
	= "docs/evidence/perl-codegen-merged-integration-source-history-20261028.json";
export const perlCodegenMergedIntegrationBase
	= "ba277e22ae55b8f792a175c67229ee2bf3cd75bf";
export const perlCodegenMergedIntegrationImplementation
	= "f06eb0bc22b12a5f487f55b036b3c5714f8cf139";
export const perlCodegenMergedIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const perlCodegenMergedIntegrationNormalizationPaths
	= perlCodegenMergedIntegrationPaths;
export const perlCodegenMergedIntegrationPathCommits = Object.freeze([
	"8a0e5484ae45dbfc5ee1a785b169862e16c6da73"
	, "f06eb0bc22b12a5f487f55b036b3c5714f8cf139"
]);
export const perlCodegenMergedIntegrationAddedPaths = Object.freeze([
	"scripts/update-perl-codegen-merged-integration-source-history.mjs"
	, "tests/helpers/perl-codegen-merged-integration-source-history-tests.mjs"
	, "tests/helpers/perl-codegen-merged-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	perlCodegenMergedIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated merged integration transition.
 *
 * @param {string} source - Complete current source.
 * @param {object} update - Recorded transition.
 */
export const reversePerlCodegenMergedIntegrationUpdate = (source, update) => {
	assert.ok(perlCodegenMergedIntegrationPaths.includes(update.path));
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
 * Remove only the exact local merged integration transition.
 *
 * @param {string} path - Repository-relative path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforePerlCodegenMergedIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !perlCodegenMergedIntegrationPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reversePerlCodegenMergedIntegrationUpdate(source, update);
};
