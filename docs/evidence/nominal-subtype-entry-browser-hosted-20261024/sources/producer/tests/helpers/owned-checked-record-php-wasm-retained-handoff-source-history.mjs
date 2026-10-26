/**
 * Reverse the owned checked-record PHP-Wasm retained handoff transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordPhpWasmRetainedHandoffHistoryPath
	= "docs/evidence/owned-checked-record-php-wasm-retained-handoff-source-history-20261022.json";
export const ownedCheckedRecordPhpWasmRetainedHandoffPredecessor
	= "2c6b6e71f8083e9e1acbcd530272073e966747a9";
export const ownedCheckedRecordPhpWasmRetainedHandoffImplementation
	= "9f0282bd95841d1bc5fe6ccfc878613e533c5978";
export const ownedCheckedRecordPhpWasmRetainedHandoffImplementationPaths
	= Object.freeze([
		"tests/helpers/owned-php-wasm-packages.mjs"
		, "tests/helpers/php-wasm-graph-packages.mjs"
		, "tests/owned-checked-record-php-wasm-packaging.test.mjs"
	]);
export const ownedCheckedRecordPhpWasmRetainedHandoffModifiedPaths
	= ownedCheckedRecordPhpWasmRetainedHandoffImplementationPaths;
export const ownedCheckedRecordPhpWasmRetainedHandoffIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const ownedCheckedRecordPhpWasmRetainedHandoffChangedPaths
	= Object.freeze([
		...ownedCheckedRecordPhpWasmRetainedHandoffModifiedPaths
		, ...ownedCheckedRecordPhpWasmRetainedHandoffIntegrationPaths
	]);
export const ownedCheckedRecordPhpWasmRetainedHandoffAddedPaths = Object.freeze([
	"scripts/update-owned-checked-record-php-wasm-retained-handoff-source-history.mjs"
	, "tests/helpers/owned-checked-record-php-wasm-retained-handoff-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-php-wasm-retained-handoff-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordPhpWasmRetainedHandoffHistoryPath, "utf8"));

/**
 * Restore one exact transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedRecordPhpWasmRetainedHandoffUpdate
	= (source, update) => {
		assert.ok(ownedCheckedRecordPhpWasmRetainedHandoffChangedPaths
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
 * Remove only the exact owned checked-record PHP-Wasm retained handoff change.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordPhpWasmRetainedHandoffSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordPhpWasmRetainedHandoffChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedCheckedRecordPhpWasmRetainedHandoffUpdate(source, update)
		: source;
};
