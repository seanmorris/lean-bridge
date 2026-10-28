/**
 * Reverse the Perl codegen replay as cherry-picked onto the Core repair line.
 *
 * The upstream record remains immutable and authenticates Claude's branch.
 * This layer authenticates the exact local transition, including the seven
 * pin edits applied to the newer type-surface inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlCodegenMergedHistoryPath
	= "docs/evidence/perl-codegen-merged-source-history-20261028.json";
export const perlCodegenMergedPredecessor
	= "ba277e22ae55b8f792a175c67229ee2bf3cd75bf";
export const perlCodegenMergedImplementation
	= "fb43ccc2f3ffbac3c39873f0c36247aeae4077da";
export const perlCodegenMergedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/perl-structured-callable-evidence.mjs"
	, "tests/helpers/perl-structured-callable-regression.mjs"
	, "tests/perl-structured-callable-contract.test.mjs"
]);
export const perlCodegenMergedNormalizationPaths = perlCodegenMergedPaths;
export const perlCodegenMergedAddedPaths = Object.freeze([
	"scripts/update-perl-codegen-merged-source-history.mjs"
	, "tests/helpers/perl-codegen-merged-source-history-tests.mjs"
	, "tests/helpers/perl-codegen-merged-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	perlCodegenMergedHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated local transition.
 *
 * @param {string} source - Complete current source.
 * @param {object} update - Recorded transition.
 */
export const reversePerlCodegenMergedUpdate = (source, update) => {
	assert.ok(perlCodegenMergedPaths.includes(update.path));
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
 * Remove only the exact local Perl replay transition.
 *
 * @param {string} path - Repository-relative path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforePerlCodegenMergedSource = (path, source, expected) => {
	if(typeof source !== "string" || !perlCodegenMergedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reversePerlCodegenMergedUpdate(source, update);
};
