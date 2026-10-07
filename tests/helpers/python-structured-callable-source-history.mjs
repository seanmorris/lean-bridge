/**
 * Preserve exact predecessor sources around structured Python callable support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeRubyStructuredCallables } from "./ruby-structured-callable-source-history.mjs";

export const pythonStructuredCallableHistoryPath = "docs/evidence/python-structured-callable-integration-20260924.json";
export const pythonStructuredCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/python.md", "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md", "docs/publish/pypi.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs", "src/adoption/test-profiles.mjs"
	, "src/backends/python/copied-model.mjs"
	, "src/backends/python/copied-values.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "tests/c-structured-callable-contract.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/rust-structured-callable-evidence.mjs"
	, "tests/helpers/rust-structured-callable-source-history.mjs"
	, "tests/python-callable-contract.test.mjs"
	, "tests/python-collection-evidence.test.mjs"
	, "tests/python-compound-contract.test.mjs"
	, "tests/python-list-contract.test.mjs"
	, "tests/rust-structured-callable-evidence.test.mjs"
	, "tests/type-surface-docs.test.mjs", "tests/type-surface.test.mjs"
].sort();
let history;
const reverse = (source, update) => {
	let end = 0; const parts = [];
	for(const edit of update.edits)
	{
		if(!Number.isSafeInteger(edit.start) || edit.start < end
			|| source.slice(edit.start, edit.start + edit.current.length) !== edit.current) return source;
		parts.push(source.slice(end, edit.start), edit.previous);
		end = edit.start + edit.current.length;
	}
	parts.push(source.slice(end));
	return parts.join("");
};

/**
 * Authenticate complete source bytes and every ordered literal edit.
 *
 * @param source - Complete source at this milestone.
 * @param update - Explicit predecessor and replacement spans.
 */
export const reversePythonStructuredCallableUpdate = (source, update) => {
	assert.ok(pythonStructuredCallableChangedPaths.includes(update.path));
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
 * Undo only recorded Python edits, leaving unrelated changes visible to checks.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or predecessor source.
 * @param expected - Optional intermediate identity at which to stop.
 */
export const beforePythonStructuredCallables = (path, source, expected) => {
	source = beforeRubyStructuredCallables(path, source, expected);
	if(typeof source === "string" && !pythonStructuredCallableChangedPaths.includes(path)) return source;
	if(sha256(source) === expected || !pythonStructuredCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(pythonStructuredCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update ? reverse(source, update) : source;
};
