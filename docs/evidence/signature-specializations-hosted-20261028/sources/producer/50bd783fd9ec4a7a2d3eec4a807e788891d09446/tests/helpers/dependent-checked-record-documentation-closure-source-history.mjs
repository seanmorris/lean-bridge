/**
 * Preserve the exact dependent checked-record documentation and archive-pin
 * closure transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordDocumentationClosureHistoryPath
	= "docs/evidence/dependent-checked-record-documentation-closure-source-history-20261023.json";
export const dependentCheckedRecordDocumentationClosurePredecessor
	= "f9885da2a7949d938a50a8ed480f74f510c4eb1d";
export const dependentCheckedRecordDocumentationClosureImplementation
	= "f4a4cf74cdc8ce18be9b7e7437a90db924c96eda";
export const dependentCheckedRecordDocumentationClosureModifiedPaths
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
		, "docs/php.md"
		, "docs/reference/types.md"
		, "docs/type-surface.v1.json"
		, "scripts/generate-type-docs.mjs"
		, "scripts/promote-dependent-checked-record-evidence.mjs"
		, "tests/type-surface-docs.test.mjs"
	]);
export const dependentCheckedRecordDocumentationClosureImplementationAddedPaths
	= Object.freeze([
		"scripts/close-dependent-checked-record-promotion.mjs"
		, "tests/helpers/type-surface-archive-pins.mjs"
	]);
export const dependentCheckedRecordDocumentationClosureImplementationPaths
	= Object.freeze([
		...dependentCheckedRecordDocumentationClosureModifiedPaths
		, ...dependentCheckedRecordDocumentationClosureImplementationAddedPaths
	]);
export const dependentCheckedRecordDocumentationClosureIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const dependentCheckedRecordDocumentationClosureNormalizationPaths
	= Object.freeze([...new Set([
		...dependentCheckedRecordDocumentationClosureModifiedPaths
		, ...dependentCheckedRecordDocumentationClosureIntegrationPaths
	])]);
export const dependentCheckedRecordDocumentationClosureHistoryAddedPaths
	= Object.freeze([
		"scripts/update-dependent-checked-record-documentation-closure-source-history.mjs"
		, "tests/helpers/dependent-checked-record-documentation-closure-source-history-tests.mjs"
		, "tests/helpers/dependent-checked-record-documentation-closure-source-history.mjs"
	]);
export const dependentCheckedRecordDocumentationClosureAddedPaths
	= Object.freeze([
		...dependentCheckedRecordDocumentationClosureImplementationAddedPaths
		, ...dependentCheckedRecordDocumentationClosureHistoryAddedPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordDocumentationClosureHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseDependentCheckedRecordDocumentationClosureUpdate = (
	source, update
) => {
	assert.ok(dependentCheckedRecordDocumentationClosureNormalizationPaths
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
 * Remove only the authenticated documentation-closure layers.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordDocumentationClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentCheckedRecordDocumentationClosureNormalizationPaths
			.includes(path)) return source;
	let current = source;
	const value = record();
	for(const update of [...value.integrationUpdates, ...value.updates])
	{
		if(sha256(current) === expected) break;
		if(update.path === path && update.currentSha256 === sha256(current))
			current = reverseDependentCheckedRecordDocumentationClosureUpdate(
				current, update);
	}
	return current;
};
