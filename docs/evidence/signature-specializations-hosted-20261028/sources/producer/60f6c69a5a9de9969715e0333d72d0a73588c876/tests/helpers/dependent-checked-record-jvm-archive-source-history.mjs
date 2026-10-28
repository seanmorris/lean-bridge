/**
 * Preserve the exact hosted JVM dependent checked-record archive milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordJvmArchiveHistoryPath
	= "docs/evidence/dependent-checked-record-jvm-archive-source-history-20261021.json";
export const dependentCheckedRecordJvmArchivePredecessor
	= "b05e78d1a8e9f02c1625109bac566b3127b735ea";
export const dependentCheckedRecordJvmArchiveImplementation
	= "675c097dd13d3efe20e1b775a03b3981535cbfbb";
export const dependentCheckedRecordJvmArchiveRoot
	= "docs/evidence/dependent-checked-record-jvm-20261021";
export const dependentCheckedRecordJvmArchiveIndexSha256
	= "99b84eee8602f98df6ccd842e4ca955f63f577a576643e088e4d29891b59162a";
export const dependentCheckedRecordJvmArchiveIndexedFileCount = 938;
export const dependentCheckedRecordJvmArchiveFileCount = 939;
export const dependentCheckedRecordJvmArchiveAddedFileCount = 941;
export const dependentCheckedRecordJvmArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-jvm-evidence-tests.mjs"
		, "tests/helpers/dependent-checked-record-jvm-evidence.mjs"
	]);
export const dependentCheckedRecordJvmArchiveImplementationPaths
	= Object.freeze(["tests/native-subtype.test.mjs"]);
export const dependentCheckedRecordJvmArchivePointerPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const dependentCheckedRecordJvmArchiveIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, ...dependentCheckedRecordJvmArchivePointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordJvmArchiveHistoryPath, "utf8"
));
const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
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
 * Reverse one exact archive implementation update.
 *
 * @param source - Complete current source text.
 * @param update - Exact implementation transition.
 */
export const reverseDependentCheckedRecordJvmArchiveImplementation = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordJvmArchiveImplementationPaths);

/**
 * Reverse one exact archive-history integration update.
 *
 * @param source - Complete current source text.
 * @param update - Exact integration transition.
 */
export const reverseDependentCheckedRecordJvmArchiveIntegration = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordJvmArchiveIntegrationPaths);

/**
 * Remove this archive history integration and, when needed, the archive's
 * original test registration without skipping either authenticated state.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which reconstruction stops.
 */
export const beforeDependentCheckedRecordJvmArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const selected = [
		...dependentCheckedRecordJvmArchiveIntegrationPaths
		, ...dependentCheckedRecordJvmArchiveImplementationPaths
	];
	if(!selected.includes(path)) return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const integration = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseDependentCheckedRecordJvmArchiveIntegration(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const implementation = record().implementationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return implementation
		? reverseDependentCheckedRecordJvmArchiveImplementation(
			source, implementation)
		: source;
};
