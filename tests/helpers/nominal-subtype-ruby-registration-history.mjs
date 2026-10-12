/**
 * Authenticate Ruby harness registration without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypeRubyRegistrationHistoryPath = "docs/evidence/nominal-subtype-ruby-registration-source-history-20261012.json";
export const nominalSubtypeRubyRegistrationPredecessor = "ae1f52cd0d9f7b1e17de552baa1ad6652f1da80f";
export const nominalSubtypeRubyRegistrationChangedPaths = [
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture-tests.mjs"
	, "tests/helpers/nominal-subtype-python-promotion-history.mjs"
];
let history;

/**
 * Reverse only complete transitions with exact current and previous digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition from the immutable ledger.
 */
export const reverseNominalSubtypeRubyRegistrationUpdate = (source, update) => {
	assert.ok(nominalSubtypeRubyRegistrationChangedPaths.includes(update.path));
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
export const beforeNominalSubtypeRubyRegistrationSource = (path, source, expected) => {
	if(typeof source !== "string" || !nominalSubtypeRubyRegistrationChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeRubyRegistrationHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeRubyRegistrationUpdate(source, update) : source;
};
