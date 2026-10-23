/**
 * Reverse the PHP-Wasm refinement CI closure hardening milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRefinementCiClosureRepairHistoryPath
	= "docs/evidence/php-wasm-refinement-ci-closure-repair-source-history-20261022.json";
export const phpWasmRefinementCiClosureRepairPredecessor
	= "ac9b90c77d51c359c863fba4c3303205bae6241a";
export const phpWasmRefinementCiClosureRepairImplementation
	= "6320d5169469bc7d70a9b2eafb5076c7e744c340";
export const phpWasmRefinementCiClosureRepairImplementationPaths = Object.freeze([
	"tests/helpers/php-wasm-refinement-ci-matrix-tests.mjs"
	, "tests/helpers/php-wasm-refinement-ci-matrix.mjs"
	, "tests/helpers/php-wasm-refinement-entry-matrix-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-matrix.mjs"
]);
export const phpWasmRefinementCiClosureRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const phpWasmRefinementCiClosureRepairChangedPaths = Object.freeze([
	...phpWasmRefinementCiClosureRepairImplementationPaths
	, ...phpWasmRefinementCiClosureRepairIntegrationPaths
]);
export const phpWasmRefinementCiClosureRepairAddedPaths = Object.freeze([
	"scripts/update-php-wasm-refinement-ci-closure-repair-source-history.mjs"
	, "tests/helpers/php-wasm-refinement-ci-closure-repair-source-history-tests.mjs"
	, "tests/helpers/php-wasm-refinement-ci-closure-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRefinementCiClosureRepairHistoryPath, "utf8"));

/**
 * Restore one exact CI-closure source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmRefinementCiClosureRepairUpdate = (source, update) => {
	assert.ok(phpWasmRefinementCiClosureRepairChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact PHP-Wasm refinement CI closure hardening.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmRefinementCiClosureRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRefinementCiClosureRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reversePhpWasmRefinementCiClosureRepairUpdate(source, update) : source;
};
