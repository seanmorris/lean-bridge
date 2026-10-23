/**
 * Preserve the exact hosted npm/browser dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordBrowserArchiveHistoryPath
	= "docs/evidence/dependent-checked-record-browser-archive-source-history-20261023.json";
export const dependentCheckedRecordBrowserArchivePredecessor
	= "733693e06a1461541d4d3d7a43d8496d26c2df45";
export const dependentCheckedRecordBrowserArchiveImplementation
	= "16bc5930257df69fb9611992339024274b4c7d14";
export const dependentCheckedRecordBrowserArchiveRoot
	= "docs/evidence/dependent-checked-record-browser-20261021";
export const dependentCheckedRecordBrowserArchiveIndexSha256
	= "1575ac337535956d04054fe650ff7204cac9b8f05b06f1428fa788743e8ceca9";
export const dependentCheckedRecordBrowserArchiveIndexedFileCount = 1211;
export const dependentCheckedRecordBrowserArchiveFileCount = 1212;
export const dependentCheckedRecordBrowserArchiveAddedFileCount = 1214;
export const dependentCheckedRecordBrowserArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-browser-evidence-tests.mjs"
		, "tests/helpers/dependent-checked-record-browser-evidence.mjs"
	]);
export const dependentCheckedRecordBrowserArchiveImplementationPaths
	= Object.freeze([
		"scripts/archive-dependent-checked-record-browser-evidence.mjs"
		, "tests/helpers/checked-record-value-index-hosted-archive.mjs"
		, "tests/helpers/dependent-checked-record-browser-report.mjs"
		, "tests/helpers/dependent-checked-record-browser-tests.mjs"
		, "tests/native-subtype.test.mjs"
	]);
export const dependentCheckedRecordBrowserArchivePointerPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const dependentCheckedRecordBrowserArchiveIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, ...dependentCheckedRecordBrowserArchivePointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordBrowserArchiveHistoryPath, "utf8"
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
export const reverseDependentCheckedRecordBrowserArchiveImplementation = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordBrowserArchiveImplementationPaths);

/**
 * Reverse one exact archive-history integration update.
 *
 * @param source - Complete current source text.
 * @param update - Exact integration transition.
 */
export const reverseDependentCheckedRecordBrowserArchiveIntegration = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordBrowserArchiveIntegrationPaths);

/**
 * Remove this archive history integration and, when needed, the archive's
 * original test registration without skipping either authenticated state.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which reconstruction stops.
 */
export const beforeDependentCheckedRecordBrowserArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const selected = [
		...dependentCheckedRecordBrowserArchiveIntegrationPaths
		, ...dependentCheckedRecordBrowserArchiveImplementationPaths
	];
	if(!selected.includes(path)) return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const integration = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseDependentCheckedRecordBrowserArchiveIntegration(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const implementation = record().implementationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return implementation
		? reverseDependentCheckedRecordBrowserArchiveImplementation(
			source, implementation)
		: source;
};
