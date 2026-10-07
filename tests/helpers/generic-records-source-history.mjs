/**
 * Preserve exact source predecessors of the Generic records change (#1433).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeReviewedFinSource } from "./reviewed-fin-source-history.mjs";

export const genericRecordsHistoryPath = "docs/evidence/generic-records-source-history-20261007.json";
export const genericRecordsChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/copied-metadata-graph.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/build/native-model.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-semantic-decisions-source-history-tests.mjs"
	, "tests/helpers/reviewed-semantic-decisions-source-history.mjs"
	, "tests/native-specializations.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseGenericRecordsUpdate = (source, update) => {
	assert.ok(genericRecordsChangedPaths.includes(update.path));
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
 * Restore the source before #1433, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeGenericRecordsSource = (path, source, expected) => {
	source = beforeReviewedFinSource(path, source, expected);
	if(typeof source !== "string" || !genericRecordsChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(genericRecordsHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseGenericRecordsUpdate(source, update) : source;
};
