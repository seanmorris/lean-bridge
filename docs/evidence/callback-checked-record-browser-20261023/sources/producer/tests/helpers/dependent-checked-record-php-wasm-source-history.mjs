/**
 * Reverse the dependent checked-record PHP-Wasm source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordPhpWasmHistoryPath
	= "docs/evidence/dependent-checked-record-php-wasm-source-history-20261021.json";
export const dependentCheckedRecordPhpWasmPredecessor
	= "2cb47d228d63a9db8c2eb5a51c62e275e9536462";
export const dependentCheckedRecordPhpWasmImplementation
	= "4286d8499cecb2dd3d17f4600adda72218b51408";
export const dependentCheckedRecordPhpWasmChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/checked-record-value-index-php-wasm.test.mjs"
	, "tests/helpers/core-quality-budget-tests.mjs"
]);
export const dependentCheckedRecordPhpWasmIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordPhpWasmHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact transition record.
 */
export const reverseDependentCheckedRecordPhpWasmUpdate = (source, update) => {
	assert.ok([...dependentCheckedRecordPhpWasmChangedPaths
		, ...dependentCheckedRecordPhpWasmIntegrationPaths].includes(update.path));
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
 * Remove only this exact dependent checked-record PHP-Wasm milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordPhpWasmSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || ![
		...dependentCheckedRecordPhpWasmChangedPaths
		, ...dependentCheckedRecordPhpWasmIntegrationPaths
	].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDependentCheckedRecordPhpWasmUpdate(source, update) : source;
};
