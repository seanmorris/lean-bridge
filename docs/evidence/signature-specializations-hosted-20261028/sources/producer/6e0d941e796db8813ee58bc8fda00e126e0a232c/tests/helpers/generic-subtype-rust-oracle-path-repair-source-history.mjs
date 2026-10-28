/**
 * Reverse the generic-Subtype Rust oracle path repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeRustOraclePathRepairHistoryPath
	= "docs/evidence/generic-subtype-rust-oracle-path-repair-source-history-20261023.json";
export const genericSubtypeRustOraclePathRepairPredecessor
	= "e25ac2c1e0a844d2bf4efa125f35d6e4a92405e9";
export const genericSubtypeRustOraclePathRepairImplementation
	= "70ba21c21e6b4c1b843446e8b432fb343f28eee6";
export const genericSubtypeRustOraclePathRepairChangedPaths = Object.freeze([
	"tests/helpers/generic-subtype-language-tests.mjs"
]);
export const genericSubtypeRustOraclePathRepairIntegrationPaths = Object.freeze([
	"tests/generic-subtype-languages.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const genericSubtypeRustOraclePathRepairNormalizationPaths = Object.freeze([
	...genericSubtypeRustOraclePathRepairChangedPaths
	, ...genericSubtypeRustOraclePathRepairIntegrationPaths
]);
export const genericSubtypeRustOraclePathRepairAddedPaths = Object.freeze([
	"scripts/update-generic-subtype-rust-oracle-path-repair-source-history.mjs"
	, "tests/helpers/generic-subtype-rust-oracle-path-repair-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-rust-oracle-path-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeRustOraclePathRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseGenericSubtypeRustOraclePathRepairUpdate = (
	source, update
) => {
	assert.ok(genericSubtypeRustOraclePathRepairNormalizationPaths
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
 * Remove only the exact generic-Subtype Rust oracle path repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeGenericSubtypeRustOraclePathRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !genericSubtypeRustOraclePathRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseGenericSubtypeRustOraclePathRepairUpdate(source, update)
		: source;
};
