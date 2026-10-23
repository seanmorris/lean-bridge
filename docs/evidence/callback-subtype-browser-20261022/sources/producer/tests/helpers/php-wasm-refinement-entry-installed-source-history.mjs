/**
 * Reverse the authenticated installed PHP-Wasm graph-entry measurement layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRefinementEntryInstalledHistoryPath
	= "docs/evidence/php-wasm-refinement-entry-installed-source-history-20261022.json";
export const phpWasmRefinementEntryInstalledPredecessor
	= "d64a5a06c1f94f14dd6d0c2ed1d25ca0a297d776";
export const phpWasmRefinementEntryInstalledImplementation
	= "85a7550e71888303b196a34d9be9f0682305874d";
export const phpWasmRefinementEntryInstalledIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const phpWasmRefinementEntryInstalledUpdatedPaths = Object.freeze([
	".github/workflows/php-wasm-refinement-entry.yml"
	, "scripts/run-php-wasm-refinement-entry-ci.sh"
	, "tests/helpers/php-wasm-refinement-entry-ci-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-installed-tests.mjs"
	, "tests/helpers/type-corpus-php-wasm-install.mjs"
	, "tests/recursive-subtype-php-wasm.test.mjs"
]);
export const phpWasmRefinementEntryInstalledImplementationAdditions = Object.freeze([
	"scripts/check-php-wasm-refinement-entry-records.mjs"
	, "tests/fixtures/php-wasm-refinement-entry/driver.mjs"
	, "tests/fixtures/php-wasm-refinement-entry/nominal-full.php"
	, "tests/fixtures/php-wasm-refinement-entry/nominal-result-only.php"
	, "tests/fixtures/php-wasm-refinement-entry/recursive-checked-record.php"
	, "tests/fixtures/php-wasm-refinement-entry/recursive-subtype.php"
	, "tests/helpers/php-wasm-entry-probe-deployment-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-callers-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-callers.mjs"
	, "tests/helpers/php-wasm-refinement-entry-driver-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-plan.mjs"
	, "tests/helpers/php-wasm-refinement-entry-report-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-report.mjs"
]);
export const phpWasmRefinementEntryInstalledImplementationPaths = Object.freeze([
	...phpWasmRefinementEntryInstalledUpdatedPaths
	, ...phpWasmRefinementEntryInstalledImplementationAdditions
]);
export const phpWasmRefinementEntryInstalledChangedPaths = Object.freeze([
	...phpWasmRefinementEntryInstalledUpdatedPaths
	, ...phpWasmRefinementEntryInstalledIntegrationPaths
]);
export const phpWasmRefinementEntryInstalledAddedPaths = Object.freeze([
	...phpWasmRefinementEntryInstalledImplementationAdditions
	, "scripts/update-php-wasm-refinement-entry-installed-source-history.mjs"
	, "tests/helpers/php-wasm-refinement-entry-installed-source-history-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-installed-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRefinementEntryInstalledHistoryPath, "utf8"));

/**
 * Restore one exact installed graph-entry source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmRefinementEntryInstalledUpdate = (source, update) => {
	assert.ok(phpWasmRefinementEntryInstalledChangedPaths.includes(update.path));
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
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this exact installed graph-entry measurement milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmRefinementEntryInstalledSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRefinementEntryInstalledChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reversePhpWasmRefinementEntryInstalledUpdate(source, update)
		: source;
};
