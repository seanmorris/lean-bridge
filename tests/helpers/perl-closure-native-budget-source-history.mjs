/**
 * Preserve exact predecessors when closing Perl documentation and extending the native CI budget.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlClosureNativeBudgetHistoryPath = "docs/evidence/perl-closure-native-budget-source-history-20261009.json";
export const perlClosureNativeBudgetPredecessor = "40fc25749a996cfb410a3b96c1268c6a8f1a9775";
export const perlClosureNativeBudgetChangedPaths = [
	"docs/type-surface.v1.json"
	, ".github/workflows/consumer-matrix.yml"
	, "docs/lean/existing-package.md"
	, "docs/publish/cpan.md"
	, "tests/documentation.test.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/native-ci-isolation.test.mjs"
	, "tests/helpers/perl-relocated-promotion-source-history.mjs"
	, "tests/perl-relocated-promotion.test.mjs"
	, "tests/helpers/perl-relocated-promotion.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/jvm-shard-ci-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePerlClosureNativeBudgetUpdate = (source, update) => {
	assert.ok(perlClosureNativeBudgetChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Restore the source before Perl documentation and native CI integration, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePerlClosureNativeBudgetSource = (path, source, expected) => {
	if(typeof source !== "string" || !perlClosureNativeBudgetChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(perlClosureNativeBudgetHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePerlClosureNativeBudgetUpdate(source, update) : source;
};
