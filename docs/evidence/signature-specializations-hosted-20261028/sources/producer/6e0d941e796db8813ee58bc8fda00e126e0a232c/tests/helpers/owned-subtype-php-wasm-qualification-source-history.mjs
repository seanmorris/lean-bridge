/**
 * Reverse the authenticated PHP-Wasm owned Subtype qualification layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypePhpWasmQualificationHistoryPath
	= "docs/evidence/owned-subtype-php-wasm-qualification-source-history-20261022.json";
export const ownedSubtypePhpWasmQualificationEvidencePath
	= "docs/evidence/owned-subtype-php-wasm-local-qualification-20261022.json";
export const ownedSubtypePhpWasmQualificationPredecessor
	= "22c1efd6c9c66c42ba438a07ca6adff6fbc7f2c5";
export const ownedSubtypePhpWasmQualificationImplementation
	= "b199dc152e553e8ade5291e54b5f96379dae4a29";
export const ownedSubtypePhpWasmQualificationChangedPaths = Object.freeze([
	".github/workflows/owned-subtype-php-wasm.yml"
	, "docs/lean/existing-package.md"
	, "docs/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/owned-subtype-php-wasm-packaging.test.mjs"
]);
export const ownedSubtypePhpWasmQualificationAddedPaths = Object.freeze([
	ownedSubtypePhpWasmQualificationEvidencePath
	, "docs/evidence/owned-subtype-php-wasm-local-qualification-20261022.md"
	, "scripts/update-owned-subtype-php-wasm-inventory.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypePhpWasmQualificationHistoryPath, "utf8"
));

/**
 * Restore one complete source after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact ordered transition.
 */
export const reverseOwnedSubtypePhpWasmQualificationUpdate = (source, update) => {
	assert.ok(ownedSubtypePhpWasmQualificationChangedPaths.includes(update.path));
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
 * Remove only the exact PHP-Wasm owned Subtype qualification layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypePhpWasmQualificationSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !ownedSubtypePhpWasmQualificationChangedPaths.includes(path))
			return source;
		const digest = sha256(source);
		if(digest === expected) return source;
		const update = record().updates.find(item =>
			item.path === path && item.currentSha256 === digest
		);
		return update
			? reverseOwnedSubtypePhpWasmQualificationUpdate(source, update)
			: source;
	};
