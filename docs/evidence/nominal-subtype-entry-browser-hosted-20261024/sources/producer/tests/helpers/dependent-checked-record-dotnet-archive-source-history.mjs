/**
 * Preserve the exact hosted .NET dependent checked-record archive milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordDotnetArchiveHistoryPath
	= "docs/evidence/dependent-checked-record-dotnet-archive-source-history-20261021.json";
export const dependentCheckedRecordDotnetArchivePredecessor
	= "11eeb5895a9eba94b5888b70a453ee3d14353b3d";
export const dependentCheckedRecordDotnetArchiveImplementation
	= "12996aceefe7821fa1b72d01408db444e374d478";
export const dependentCheckedRecordDotnetArchiveRoot
	= "docs/evidence/dependent-checked-record-dotnet-20261021";
export const dependentCheckedRecordDotnetArchiveIndexSha256
	= "d2ec61bbd52061c90a6fc4ead14c8cbc3477df24c002b8fe8ce94b665762af92";
export const dependentCheckedRecordDotnetArchiveIndexedFileCount = 808;
export const dependentCheckedRecordDotnetArchiveFileCount = 809;
export const dependentCheckedRecordDotnetArchiveAddedFileCount = 811;
export const dependentCheckedRecordDotnetArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-dotnet-evidence-tests.mjs"
		, "tests/helpers/dependent-checked-record-dotnet-evidence.mjs"
	]);
export const dependentCheckedRecordDotnetArchiveImplementationPaths
	= Object.freeze(["tests/native-subtype.test.mjs"]);
export const dependentCheckedRecordDotnetArchivePointerPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const dependentCheckedRecordDotnetArchiveIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, ...dependentCheckedRecordDotnetArchivePointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordDotnetArchiveHistoryPath, "utf8"
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
export const reverseDependentCheckedRecordDotnetArchiveImplementation = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordDotnetArchiveImplementationPaths);

/**
 * Reverse one exact archive-history integration update.
 *
 * @param source - Complete current source text.
 * @param update - Exact integration transition.
 */
export const reverseDependentCheckedRecordDotnetArchiveIntegration = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordDotnetArchiveIntegrationPaths);

/**
 * Remove this archive history integration and, when needed, the archive's
 * original test registration without skipping either authenticated state.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which reconstruction stops.
 */
export const beforeDependentCheckedRecordDotnetArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const selected = [
		...dependentCheckedRecordDotnetArchiveIntegrationPaths
		, ...dependentCheckedRecordDotnetArchiveImplementationPaths
	];
	if(!selected.includes(path)) return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const integration = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseDependentCheckedRecordDotnetArchiveIntegration(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const implementation = record().implementationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return implementation
		? reverseDependentCheckedRecordDotnetArchiveImplementation(
			source, implementation)
		: source;
};
