/**
 * Preserve the exact recursive checked-record documentation closure
 * transition and its live inventory pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const recursiveCheckedRecordDocumentationClosureHistoryPath
	= "docs/evidence/recursive-checked-record-documentation-closure-source-history-20261023.json";
export const recursiveCheckedRecordDocumentationClosurePredecessor
	= "23ae28e37befcdf245e94f5f841ed50254fc869c";
export const recursiveCheckedRecordDocumentationClosureImplementation
	= "d2d77db0cf6d4a9f509bfe14954f5abbeef6ddb5";
export const recursiveCheckedRecordDocumentationClosureModifiedPaths
	= Object.freeze([
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
		, "docs/javascript-typescript.md"
		, "docs/lean/existing-package.md"
		, "docs/php.md"
		, "docs/reference/types.md"
		, "tests/helpers/recursive-checked-record-promotion-tests.mjs"
	]);
export const recursiveCheckedRecordDocumentationClosureImplementationPaths
	= recursiveCheckedRecordDocumentationClosureModifiedPaths;
export const recursiveCheckedRecordDocumentationClosureIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/component-array-contract.test.mjs"
		, "tests/helpers/callback-subtype-promotion-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/nested-checked-records.test.mjs"
	]);
export const recursiveCheckedRecordDocumentationClosureNormalizationPaths
	= Object.freeze([...new Set([
		...recursiveCheckedRecordDocumentationClosureModifiedPaths
		, ...recursiveCheckedRecordDocumentationClosureIntegrationPaths
	])]);
export const recursiveCheckedRecordDocumentationClosureAddedPaths
	= Object.freeze([
		"scripts/update-recursive-checked-record-documentation-closure-source-history.mjs"
		, "tests/helpers/recursive-checked-record-documentation-closure-source-history-tests.mjs"
		, "tests/helpers/recursive-checked-record-documentation-closure-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	recursiveCheckedRecordDocumentationClosureHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseRecursiveCheckedRecordDocumentationClosureUpdate = (
	source, update
) => {
	assert.ok(recursiveCheckedRecordDocumentationClosureNormalizationPaths
		.includes(update.path));
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
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
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
 * Remove one authenticated recursive documentation-closure transition.
 * A recognized update is always reversed; the central hub decides where an
 * expected historical digest stops and re-enters for any further transition.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeRecursiveCheckedRecordDocumentationClosureSource = (
	path, source, expected
) => {
	void expected;
	if(typeof source !== "string"
		|| !recursiveCheckedRecordDocumentationClosureNormalizationPaths
			.includes(path)) return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseRecursiveCheckedRecordDocumentationClosureUpdate(source, update);
};
