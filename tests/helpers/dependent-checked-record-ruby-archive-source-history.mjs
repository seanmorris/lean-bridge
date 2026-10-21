/**
 * Preserve the exact hosted Ruby dependent checked-record archive milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordRubyArchiveHistoryPath
	= "docs/evidence/dependent-checked-record-ruby-archive-source-history-20261021.json";
export const dependentCheckedRecordRubyArchivePredecessor
	= "ac48e11d740d7f7d17476d3543e22f1cd94b759a";
export const dependentCheckedRecordRubyArchiveImplementation
	= "b1a281a87e9ad3b6084ee9645da675ee0d0d4d93";
export const dependentCheckedRecordRubyArchiveRoot
	= "docs/evidence/dependent-checked-record-ruby-20261021";
export const dependentCheckedRecordRubyArchiveIndexSha256
	= "b485f3c220d4d8996bcccc3a5e740687e90f4ec519bf5a302e98f8498872d20f";
export const dependentCheckedRecordRubyArchiveIndexedFileCount = 1431;
export const dependentCheckedRecordRubyArchiveFileCount = 1432;
export const dependentCheckedRecordRubyArchiveAddedFileCount = 1434;
export const dependentCheckedRecordRubyArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-ruby-evidence-tests.mjs"
		, "tests/helpers/dependent-checked-record-ruby-evidence.mjs"
	]);
export const dependentCheckedRecordRubyArchiveImplementationPaths
	= Object.freeze(["tests/native-subtype.test.mjs"]);
export const dependentCheckedRecordRubyArchivePointerPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const dependentCheckedRecordRubyArchiveIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, ...dependentCheckedRecordRubyArchivePointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordRubyArchiveHistoryPath, "utf8"
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
export const reverseDependentCheckedRecordRubyArchiveImplementation = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordRubyArchiveImplementationPaths);

/**
 * Reverse one exact archive-history integration update.
 *
 * @param source - Complete current source text.
 * @param update - Exact integration transition.
 */
export const reverseDependentCheckedRecordRubyArchiveIntegration = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordRubyArchiveIntegrationPaths);

/**
 * Remove this archive history integration and, when needed, the archive's
 * original test registration without skipping either authenticated state.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which reconstruction stops.
 */
export const beforeDependentCheckedRecordRubyArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const selected = [
		...dependentCheckedRecordRubyArchiveIntegrationPaths
		, ...dependentCheckedRecordRubyArchiveImplementationPaths
	];
	if(!selected.includes(path)) return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const integration = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseDependentCheckedRecordRubyArchiveIntegration(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const implementation = record().implementationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return implementation
		? reverseDependentCheckedRecordRubyArchiveImplementation(
			source, implementation)
		: source;
};
