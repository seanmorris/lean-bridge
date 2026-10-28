/**
 * Preserve the exact hosted C/C++ dependent checked-record archive milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordNativeArchiveHistoryPath
	= "docs/evidence/dependent-checked-record-native-archive-source-history-20261021.json";
export const dependentCheckedRecordNativeArchivePredecessor
	= "f6c98627e7bf58fabbae4093636675ebb19ed8fe";
export const dependentCheckedRecordNativeArchiveImplementation
	= "3ae72d97e8dde408beb12120765190ff8d011a18";
export const dependentCheckedRecordNativeArchiveRoot
	= "docs/evidence/dependent-checked-record-native-20261021";
export const dependentCheckedRecordNativeArchiveIndexSha256
	= "ba64efbdf0237ef967ed57ce752a9fd9c3157ecc00ac7b7ac98c27bc827d0ff7";
export const dependentCheckedRecordNativeArchiveIndexedFileCount = 817;
export const dependentCheckedRecordNativeArchiveFileCount = 818;
export const dependentCheckedRecordNativeArchiveAddedFileCount = 820;
export const dependentCheckedRecordNativeArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-native-evidence-tests.mjs"
		, "tests/helpers/dependent-checked-record-native-evidence.mjs"
	]);
export const dependentCheckedRecordNativeArchiveImplementationPaths
	= Object.freeze([
		"tests/helpers/zero-payload-checked-record-hosted-evidence.mjs"
		, "tests/native-subtype.test.mjs"
	]);
export const dependentCheckedRecordNativeArchivePointerPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const dependentCheckedRecordNativeArchiveIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, ...dependentCheckedRecordNativeArchivePointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordNativeArchiveHistoryPath, "utf8"
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
export const reverseDependentCheckedRecordNativeArchiveImplementation = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordNativeArchiveImplementationPaths);

/**
 * Reverse one exact archive-history integration update.
 *
 * @param source - Complete current source text.
 * @param update - Exact integration transition.
 */
export const reverseDependentCheckedRecordNativeArchiveIntegration = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordNativeArchiveIntegrationPaths);

/**
 * Remove this archive history integration and, when needed, the archive's
 * original test registration without skipping either authenticated state.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which reconstruction stops.
 */
export const beforeDependentCheckedRecordNativeArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const selected = [
		...dependentCheckedRecordNativeArchiveIntegrationPaths
		, ...dependentCheckedRecordNativeArchiveImplementationPaths
	];
	if(!selected.includes(path)) return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const integration = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseDependentCheckedRecordNativeArchiveIntegration(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const implementation = record().implementationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return implementation
		? reverseDependentCheckedRecordNativeArchiveImplementation(
			source, implementation)
		: source;
};
