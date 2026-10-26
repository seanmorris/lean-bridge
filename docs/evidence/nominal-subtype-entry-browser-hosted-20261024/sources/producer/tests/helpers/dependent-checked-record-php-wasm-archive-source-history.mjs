/**
 * Preserve the exact hosted PHP-Wasm dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordPhpWasmArchiveHistoryPath
	= "docs/evidence/dependent-checked-record-php-wasm-archive-source-history-20261021.json";
export const dependentCheckedRecordPhpWasmArchivePredecessor
	= "764e6a5443eb8d838d634c592aa8f88b6a2c9f3c";
export const dependentCheckedRecordPhpWasmArchiveImplementation
	= "8463c96ed7770947b4e1719ad80c94761e0cf79b";
export const dependentCheckedRecordPhpWasmArchiveRoot
	= "docs/evidence/dependent-checked-record-php-wasm-20261021";
export const dependentCheckedRecordPhpWasmArchiveIndexSha256
	= "948cbee670d29c1ba97dc64ceb1771b7c74b0f23f7ba1d09091826939e455091";
export const dependentCheckedRecordPhpWasmArchiveIndexedFileCount = 2411;
export const dependentCheckedRecordPhpWasmArchiveFileCount = 2412;
export const dependentCheckedRecordPhpWasmArchiveAddedFileCount = 2414;
export const dependentCheckedRecordPhpWasmArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-php-wasm-evidence-tests.mjs"
		, "tests/helpers/dependent-checked-record-php-wasm-evidence.mjs"
	]);
export const dependentCheckedRecordPhpWasmArchiveImplementationPaths
	= Object.freeze(["tests/native-subtype.test.mjs"]);
export const dependentCheckedRecordPhpWasmArchivePointerPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const dependentCheckedRecordPhpWasmArchiveIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, ...dependentCheckedRecordPhpWasmArchivePointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordPhpWasmArchiveHistoryPath, "utf8"));
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
export const reverseDependentCheckedRecordPhpWasmArchiveImplementation = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordPhpWasmArchiveImplementationPaths);

/**
 * Reverse one exact archive-history integration update.
 *
 * @param source - Complete current source text.
 * @param update - Exact integration transition.
 */
export const reverseDependentCheckedRecordPhpWasmArchiveIntegration = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordPhpWasmArchiveIntegrationPaths);

/**
 * Remove this archive history integration and original test registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeDependentCheckedRecordPhpWasmArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const selected = [
		...dependentCheckedRecordPhpWasmArchiveIntegrationPaths
		, ...dependentCheckedRecordPhpWasmArchiveImplementationPaths
	];
	if(!selected.includes(path)) return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const integration = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseDependentCheckedRecordPhpWasmArchiveIntegration(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const implementation = record().implementationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return implementation
		? reverseDependentCheckedRecordPhpWasmArchiveImplementation(
			source, implementation)
		: source;
};
