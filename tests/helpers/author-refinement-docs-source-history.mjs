/**
 * Preserve exact predecessors when reconciling author guidance with accepted refinement receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const authorRefinementDocsHistoryPath = "docs/evidence/author-refinement-docs-source-history-20261009.json";
export const authorRefinementDocsPredecessor = "c34267cd91b4acd7a5fded0dee99a789e627b869";
export const authorRefinementDocsChangedPaths = [
	"docs/type-surface.v1.json"
	, "docs/lean/existing-package.md"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/dotnet-dispatch-integration-source-history.mjs"
	, "tests/helpers/dotnet-dispatch-integration-source-history-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseAuthorRefinementDocsUpdate = (source, update) => {
	assert.ok(authorRefinementDocsChangedPaths.includes(update.path));
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
export const beforeAuthorRefinementDocsSource = (path, source, expected) => {
	if(typeof source !== "string" || !authorRefinementDocsChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(authorRefinementDocsHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseAuthorRefinementDocsUpdate(source, update) : source;
};
