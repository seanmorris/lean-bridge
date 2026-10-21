/**
 * Authenticate PHP copied-function keyword escaping as one exact, reversible
 * source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpCopiedKeywordHistoryPath
	= "docs/evidence/php-copied-keyword-source-history-20261017.json";
export const phpCopiedKeywordPredecessor
	= "f370d8ca6359885e6b2f8ab84e20b5a7c7727cc1";
export const phpCopiedKeywordDraftParent
	= "7d564408dc07609e87c2cf60b39e396a2f58eb7c";
export const phpCopiedKeywordChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "src/backends/php/copied-model.mjs"
	, "src/backends/php/copied-values.mjs"
	, "src/backends/php/copied-zend.mjs"
	, "tests/fixtures/inherited-checked-record-consumers/php-native.php"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/inherited-checked-record-php-wasm-tests.mjs"
	, "tests/native-php.test.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const phpCopiedKeywordAddedPaths = Object.freeze([
	"scripts/update-php-copied-keyword-source-history.mjs"
	, "tests/helpers/php-copied-keyword-source-history.mjs"
	, "tests/php-copied-keyword-source-history.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	phpCopiedKeywordHistoryPath, "utf8"
));

/**
 * Reverse one exact PHP copied keyword transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reversePhpCopiedKeywordUpdate = (source, update) => {
	assert.ok(phpCopiedKeywordChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
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
 * Remove only this PHP copied-function keyword layer from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpCopiedKeywordSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpCopiedKeywordChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reversePhpCopiedKeywordUpdate(source, update)
		: source;
};
