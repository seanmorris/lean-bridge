/**
 * Preserve the exact hosted native-PHP dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordPhpArchiveHistoryPath
	= "docs/evidence/dependent-checked-record-php-archive-source-history-20261021.json";
export const dependentCheckedRecordPhpArchivePredecessor
	= "9726d5d4ab5a72befcbb904e32b5c8b0390af447";
export const dependentCheckedRecordPhpArchiveImplementation
	= "b0638b4f8b8f2d529d4d509a787d9a814de44792";
export const dependentCheckedRecordPhpArchiveRoot
	= "docs/evidence/dependent-checked-record-php-20261021";
export const dependentCheckedRecordPhpArchiveIndexSha256
	= "7c9dbd914da5d205852565d4c968575c9762fa6560a13faa71e0aa47d65bdc16";
export const dependentCheckedRecordPhpArchiveIndexedFileCount = 1008;
export const dependentCheckedRecordPhpArchiveFileCount = 1009;
export const dependentCheckedRecordPhpArchiveAddedFileCount = 1011;
export const dependentCheckedRecordPhpArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-php-evidence-tests.mjs"
		, "tests/helpers/dependent-checked-record-php-evidence.mjs"
	]);
export const dependentCheckedRecordPhpArchiveImplementationPaths
	= Object.freeze(["tests/native-subtype.test.mjs"]);
export const dependentCheckedRecordPhpArchivePointerPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const dependentCheckedRecordPhpArchiveIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, ...dependentCheckedRecordPhpArchivePointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordPhpArchiveHistoryPath, "utf8"));
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
export const reverseDependentCheckedRecordPhpArchiveImplementation = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordPhpArchiveImplementationPaths);

/**
 * Reverse one exact archive-history integration update.
 *
 * @param source - Complete current source text.
 * @param update - Exact integration transition.
 */
export const reverseDependentCheckedRecordPhpArchiveIntegration = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordPhpArchiveIntegrationPaths);

/**
 * Remove this archive history integration and original test registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeDependentCheckedRecordPhpArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const selected = [
		...dependentCheckedRecordPhpArchiveIntegrationPaths
		, ...dependentCheckedRecordPhpArchiveImplementationPaths
	];
	if(!selected.includes(path)) return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const integration = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseDependentCheckedRecordPhpArchiveIntegration(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const implementation = record().implementationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return implementation
		? reverseDependentCheckedRecordPhpArchiveImplementation(
			source, implementation)
		: source;
};
