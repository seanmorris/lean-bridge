/**
 * Preserve the exact hosted Python dependent checked-record archive milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordPythonArchiveHistoryPath
	= "docs/evidence/dependent-checked-record-python-archive-source-history-20261021.json";
export const dependentCheckedRecordPythonArchivePredecessor
	= "7dd9083c276e904052cc44f774f7a19322175d5f";
export const dependentCheckedRecordPythonArchiveImplementation
	= "663ec2dc0ff064a1a1b75b126993736cb4ec1609";
export const dependentCheckedRecordPythonArchiveRoot
	= "docs/evidence/dependent-checked-record-python-20261021";
export const dependentCheckedRecordPythonArchiveIndexSha256
	= "155bbc1b1ad4a2a2b24aef87d4683050e5fd3ecca051fd86a91a1d70f4a04d4a";
export const dependentCheckedRecordPythonArchiveIndexedFileCount = 1475;
export const dependentCheckedRecordPythonArchiveFileCount = 1476;
export const dependentCheckedRecordPythonArchiveAddedFileCount = 1478;
export const dependentCheckedRecordPythonArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-python-evidence-tests.mjs"
		, "tests/helpers/dependent-checked-record-python-evidence.mjs"
	]);
export const dependentCheckedRecordPythonArchiveImplementationPaths
	= Object.freeze(["tests/native-subtype.test.mjs"]);
export const dependentCheckedRecordPythonArchivePointerPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const dependentCheckedRecordPythonArchiveIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, ...dependentCheckedRecordPythonArchivePointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordPythonArchiveHistoryPath, "utf8"
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
export const reverseDependentCheckedRecordPythonArchiveImplementation = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordPythonArchiveImplementationPaths);

/**
 * Reverse one exact archive-history integration update.
 *
 * @param source - Complete current source text.
 * @param update - Exact integration transition.
 */
export const reverseDependentCheckedRecordPythonArchiveIntegration = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordPythonArchiveIntegrationPaths);

/**
 * Remove this archive history integration and, when needed, the archive's
 * original test registration without skipping either authenticated state.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which reconstruction stops.
 */
export const beforeDependentCheckedRecordPythonArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const selected = [
		...dependentCheckedRecordPythonArchiveIntegrationPaths
		, ...dependentCheckedRecordPythonArchiveImplementationPaths
	];
	if(!selected.includes(path)) return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const integration = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseDependentCheckedRecordPythonArchiveIntegration(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const implementation = record().implementationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return implementation
		? reverseDependentCheckedRecordPythonArchiveImplementation(
			source, implementation)
		: source;
};
