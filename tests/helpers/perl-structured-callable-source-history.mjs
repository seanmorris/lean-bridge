/**
 * Preserve exact predecessor sources around structured Perl callable support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeNpmStructuredCallables } from "./npm-structured-callable-source-history.mjs";

export const perlStructuredCallableHistoryPath = "docs/evidence/perl-structured-callable-integration-20260925.json";
export const perlStructuredCallableChangedPaths = [
	".github/workflows/perl-consumer.yml", "docs/consume/perl.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/publish/cpan.md", "docs/reference/types.md"
	, "docs/type-surface.v1.json", "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs", "src/backends/perl/copied-aliases.mjs"
	, "src/backends/perl/generate.mjs", "tests/documentation.test.mjs"
	, "tests/callable-evidence.test.mjs"
	, "tests/fixtures/callable-consumers/perl.pl"
	, "tests/fixtures/compound-consumers/perl.pl"
	, "tests/helpers/jvm-structured-callable-evidence.mjs"
	, "tests/helpers/jvm-structured-callable-source-history.mjs"
	, "tests/jvm-structured-callable-evidence.test.mjs"
	, "tests/perl-collection-evidence.test.mjs"
	, "tests/perl-compound-contract.test.mjs", "tests/perl-list-contract.test.mjs"
	, "tests/perl-variant-contract.test.mjs"
	, "tests/perl-variant-evidence.test.mjs"
	, "tests/type-surface-docs.test.mjs", "tests/type-surface.test.mjs"
].sort();
let history;
const reverse = (source, update) => {
	let result = source;
	for(const edit of update.edits.toReversed())
	{
		if(result.slice(edit.start, edit.start + edit.current.length) !== edit.current) return source;
		result = result.slice(0, edit.start) + edit.previous + result.slice(edit.start + edit.current.length);
	}
	return result;
};

/**
 * Authenticate complete source bytes and every ordered literal edit.
 *
 * @param source - Complete source at this milestone.
 * @param update - Explicit predecessor and replacement spans.
 */
export const reversePerlStructuredCallableUpdate = (source, update) => {
	assert.ok(perlStructuredCallableChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		end = edit.start + edit.current.length;
	}
	const previous = reverse(source, update);
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Undo recorded Perl edits while leaving unrelated drift visible to checks.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or predecessor source.
 * @param expected - Optional intermediate identity at which to stop.
 */
export const beforePerlStructuredCallables = (path, source, expected) => {
	source = beforeNpmStructuredCallables(path, source, expected);
	if(sha256(source) === expected || !perlStructuredCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(perlStructuredCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update ? reverse(source, update) : source;
};
