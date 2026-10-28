/**
 * Reverse the complete zero-payload checked-record matrix closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadMatrixClosureHistoryPath
	= "docs/evidence/zero-payload-checked-record-matrix-closure-source-history-20261022.json";
export const zeroPayloadMatrixClosurePredecessor
	= "fa0e876a08e808cb05412fda732bab5d705737e2";
export const zeroPayloadMatrixClosureImplementation
	= "1321929be2abca4b2d75a351604c8d5770607e43";
export const zeroPayloadMatrixClosureImplementationPaths = Object.freeze([
	"docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/evidence/zero-payload-checked-record-matrix-closure-20261022.json"
	, "docs/evidence/zero-payload-checked-record-matrix-closure-20261022.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/reference/types.md"
	, "scripts/generate-type-docs.mjs"
	, "tests/type-surface-docs.test.mjs"
]);
export const zeroPayloadMatrixClosureModifiedPaths = Object.freeze(
	zeroPayloadMatrixClosureImplementationPaths.filter(path =>
		!path.startsWith("docs/evidence/zero-payload-checked-record-matrix-closure-20261022."))
);
export const zeroPayloadMatrixClosureImplementationAdditions = Object.freeze([
	"docs/evidence/zero-payload-checked-record-matrix-closure-20261022.json"
	, "docs/evidence/zero-payload-checked-record-matrix-closure-20261022.md"
]);
export const zeroPayloadMatrixClosureIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const zeroPayloadMatrixClosureChangedPaths = Object.freeze([
	...zeroPayloadMatrixClosureModifiedPaths
	, ...zeroPayloadMatrixClosureIntegrationPaths
]);
export const zeroPayloadMatrixClosureAddedPaths = Object.freeze([
	...zeroPayloadMatrixClosureImplementationAdditions
	, "scripts/update-zero-payload-matrix-closure-source-history.mjs"
	, "tests/helpers/zero-payload-matrix-closure-source-history-tests.mjs"
	, "tests/helpers/zero-payload-matrix-closure-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadMatrixClosureHistoryPath, "utf8"));

/**
 * Restore one exact matrix-closure transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadMatrixClosureUpdate = (source, update) => {
	assert.ok(zeroPayloadMatrixClosureChangedPaths.includes(update.path));
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
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact zero-payload matrix closure.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadMatrixClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !zeroPayloadMatrixClosureChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseZeroPayloadMatrixClosureUpdate(source, update)
		: source;
};
