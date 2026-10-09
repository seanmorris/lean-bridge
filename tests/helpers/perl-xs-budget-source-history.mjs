/**
 * Preserve exact source predecessors when increasing the complete Perl XS acceptance job budget.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlXsBudgetHistoryPath = "docs/evidence/perl-xs-budget-source-history-20261009.json";
export const perlXsBudgetPredecessor = "c6f47e40354d25df27c4d0a415862a623761bdf2";
export const perlXsBudgetChangedPaths = [
	"docs/type-surface.v1.json"
	, ".github/workflows/perl-consumer.yml"
	, "tests/documentation.test.mjs"
	, "tests/dotnet-recursive-callable-evidence.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/inherited-record-archive-source-history.mjs"
	, "tests/helpers/inherited-record-archive-source-history-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePerlXsBudgetUpdate = (source, update) => {
	assert.ok(perlXsBudgetChangedPaths.includes(update.path));
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
 * Restore the pre-integration source, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePerlXsBudgetSource = (path, source, expected) => {
	if(typeof source !== "string" || !perlXsBudgetChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(perlXsBudgetHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePerlXsBudgetUpdate(source, update) : source;
};
