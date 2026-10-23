/**
 * Authenticate Refinement Core CI repairs without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeCheckedRecordPerlSource } from "./checked-record-perl-history.mjs";

export const refinementCoreCiHistoryPath = "docs/evidence/refinement-core-ci-source-history-20261011.json";
export const refinementCoreCiPredecessor = "08eb94ef6321b8a58ea4c57b9e13dfa7522ee49b";
export const refinementCoreCiChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/cli-contract.test.mjs"
	, "tests/helpers/checked-record-host-ci-history-tests.mjs"
	, "tests/helpers/checked-record-host-ci-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/scalar-fin-source-entry-run-tests.mjs"
	, "tests/lean-project-analyzer.test.mjs"
	, "tests/perl-relocated-promotion.test.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseRefinementCoreCiUpdate = (source, update) => {
	assert.ok(refinementCoreCiChangedPaths.includes(update.path));
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
 * Restore only authenticated predecessors, preserving requested stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRefinementCoreCiSource = (path, source, expected) => {
	source = beforeCheckedRecordPerlSource(path, source, expected);
	if(typeof source !== "string" || !refinementCoreCiChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(refinementCoreCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseRefinementCoreCiUpdate(source, update) : source;
};
