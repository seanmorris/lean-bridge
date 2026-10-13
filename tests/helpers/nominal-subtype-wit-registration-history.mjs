/**
 * Authenticate WIT harness registration without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypeWitCiSource } from "./nominal-subtype-wit-ci-history.mjs";

export const nominalSubtypeWitRegistrationHistoryPath = "docs/evidence/nominal-subtype-wit-registration-source-history-20261013.json";
export const nominalSubtypeWitRegistrationPredecessor = "c7257172d9756a03513a7e666c5d65af8975c350";
export const nominalSubtypeWitRegistrationChangedPaths = [
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture-tests.mjs"
	, "tests/helpers/nominal-subtype-php-promotion-history.mjs"
];
let history;

/**
 * Reverse only complete transitions with exact current and previous digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition from the immutable ledger.
 */
export const reverseNominalSubtypeWitRegistrationUpdate = (source, update) => {
	assert.ok(nominalSubtypeWitRegistrationChangedPaths.includes(update.path));
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
export const beforeNominalSubtypeWitRegistrationSource = (path, source, expected) => {
	source = beforeNominalSubtypeWitCiSource(path, source, expected);
	if(typeof source !== "string" || !nominalSubtypeWitRegistrationChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeWitRegistrationHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeWitRegistrationUpdate(source, update) : source;
};
