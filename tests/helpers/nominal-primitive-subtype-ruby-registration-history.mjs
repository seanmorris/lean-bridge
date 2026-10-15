/**
 * Authenticate primitive-base Ruby harness registration without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalPrimitiveSubtypeRubyRegistrationHistoryPath = "docs/evidence/nominal-primitive-subtype-ruby-registration-source-history-20261014.json";
export const nominalPrimitiveSubtypeRubyRegistrationPredecessor = "6990c45fb225e4150b1aca8d6b19415226e8c766";
export const nominalPrimitiveSubtypeRubyRegistrationChangedPaths = [
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-history.mjs"
];
let history;

/**
 * Reverse only complete transitions with exact current and previous digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition from the immutable ledger.
 */
export const reverseNominalPrimitiveSubtypeRubyRegistrationUpdate = (source, update) => {
	assert.ok(nominalPrimitiveSubtypeRubyRegistrationChangedPaths.includes(update.path));
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
 * Replay an authenticated transition from its exact predecessor source.
 *
 * @param source - Complete predecessor source text.
 * @param update - Authenticated transition from the immutable ledger.
 */
export const applyNominalPrimitiveSubtypeRubyRegistrationUpdate = (source, update) => {
	assert.ok(nominalPrimitiveSubtypeRubyRegistrationChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.previousSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0, delta = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= delta);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		const start = edit.start - delta;
		assert.ok(start >= cursor && start <= source.length);
		assert.equal(source.slice(start, start + edit.previous.length), edit.previous);
		parts.push(source.slice(cursor, start), edit.current);
		cursor = start + edit.previous.length;
		delta += edit.current.length - edit.previous.length;
	}
	parts.push(source.slice(cursor));
	const current = parts.join(""); assert.equal(sha256(current), update.currentSha256, update.path);
	return current;
};

/**
 * Preserve unknown edits and stop at the explicitly requested source epoch.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current source text.
 * @param expected - Optional stopping digest.
 */
export const beforeNominalPrimitiveSubtypeRubyRegistrationSource = (path, source, expected) => {
	if(typeof source !== "string" || !nominalPrimitiveSubtypeRubyRegistrationChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeRubyRegistrationHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalPrimitiveSubtypeRubyRegistrationUpdate(source, update) : source;
};
