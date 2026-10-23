/**
 * Restore the owned-Subtype PHP-Wasm package transition that predates its
 * qualification history. The original implementation commit remains
 * immutable; this layer records the omitted edge between its exact Git blobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypePhpWasmPackageGapHistoryPath
	= "docs/evidence/owned-subtype-php-wasm-package-gap-source-history-20261022.json";
export const ownedSubtypePhpWasmPackageGapPredecessor
	= "209b13b86b8d23a10a76de73bbf1c1f095d5fe31";
export const ownedSubtypePhpWasmPackageGapImplementation
	= "22c1efd6c9c66c42ba438a07ca6adff6fbc7f2c5";
export const ownedSubtypePhpWasmPackageGapIntegrationPredecessor
	= "8817a06c962fbae28acaac2fbdcb45afe2b043ce";
export const ownedSubtypePhpWasmPackageGapHistoricalPaths = Object.freeze([
	"config/cli-package.v1.json"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/owned-php-wasm-browser.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const ownedSubtypePhpWasmPackageGapHistoricalAdditions = Object.freeze([
	".github/workflows/owned-subtype-php-wasm.yml"
	, "tests/fixtures/structured-types/owned-subtype-php-wasm.php"
	, "tests/owned-subtype-php-wasm-packaging.test.mjs"
]);
export const ownedSubtypePhpWasmPackageGapIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const ownedSubtypePhpWasmPackageGapAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-php-wasm-package-gap-source-history.mjs"
	, "tests/helpers/owned-subtype-php-wasm-package-gap-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-php-wasm-package-gap-source-history.mjs"
]);
export const ownedSubtypePhpWasmPackageGapChangedPaths = Object.freeze([
	...ownedSubtypePhpWasmPackageGapHistoricalPaths
	, ...ownedSubtypePhpWasmPackageGapIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypePhpWasmPackageGapHistoryPath, "utf8"));

const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
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
 * Reverse the exact omitted historical transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated historical transition.
 */
export const reverseOwnedSubtypePhpWasmPackageGapHistorical
	= (source, update) => reverse(
		source, update, ownedSubtypePhpWasmPackageGapHistoricalPaths);

/**
 * Reverse one repair-integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated integration transition.
 */
export const reverseOwnedSubtypePhpWasmPackageGapIntegration
	= (source, update) => reverse(
		source, update, ownedSubtypePhpWasmPackageGapIntegrationPaths);

/**
 * Remove the repair integration or omitted historical transition whenever the
 * supplied bytes are one of the authenticated current endpoints.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypePhpWasmPackageGapSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	if(ownedSubtypePhpWasmPackageGapIntegrationPaths.includes(path))
	{
		const update = record().integrationUpdates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update)
		{
			source = reverseOwnedSubtypePhpWasmPackageGapIntegration(source, update);
			digest = sha256(source);
			if(digest === expected) return source;
		}
	}
	if(!ownedSubtypePhpWasmPackageGapHistoricalPaths.includes(path)) return source;
	const update = record().historicalUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedSubtypePhpWasmPackageGapHistorical(source, update)
		: source;
};
