/**
 * Authenticate the managed gate test repair without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypePhpCiSource } from "./nominal-subtype-php-ci-history.mjs";

export const managedNominalGateHistoryPath = "docs/evidence/managed-nominal-gate-source-history-20261013.json";
export const managedNominalGatePredecessor = "968c1e9877c6cffe0667b81b4ea71bf18b46fd75";
export const managedNominalGateChangedPaths = [
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/managed-ci-isolation.mjs"
	, "tests/helpers/nominal-subtype-php-registration-history.mjs"
	, "tests/managed-ci-isolation.test.mjs"
];
let history;

/**
 * Reverse only complete transitions with exact current and previous digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition from the immutable ledger.
 */
export const reverseManagedNominalGateUpdate = (source, update) => {
	assert.ok(managedNominalGateChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Preserve unknown edits and stop at the explicitly requested source epoch.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current source text.
 * @param expected - Optional stopping digest.
 */
export const beforeManagedNominalGateSource = (path, source, expected) => {
	source = beforeNominalSubtypePhpCiSource(path, source, expected);
	if(typeof source !== "string" || !managedNominalGateChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(managedNominalGateHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseManagedNominalGateUpdate(source, update) : source;
};
