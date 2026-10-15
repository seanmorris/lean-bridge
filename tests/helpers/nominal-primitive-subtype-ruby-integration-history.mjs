/**
 * Authenticate the merge of existing primitive-base and Ruby support histories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeNominalPrimitiveSubtypeRubyRegistrationSource } from "./nominal-primitive-subtype-ruby-registration-history.mjs";
import { beforeNominalPrimitiveSubtypePerlPromotionSource } from "./nominal-primitive-subtype-perl-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalPrimitiveSubtypeRubyIntegrationHistoryPath = "docs/evidence/nominal-primitive-subtype-ruby-integration-source-history-20261015.json";
export const nominalPrimitiveSubtypeRubyIntegrationPredecessor = "e15acb534151d359b05b68364ab35e6ab6c77073";
export const nominalPrimitiveSubtypeRubyIntegrationAlternate = "f3a7928682cf87c59f3906796202c681f40633cd";
export const nominalPrimitiveSubtypeRubyIntegrationChangedPaths = [
	"tests/helpers/core-quality-budget-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-integration-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-ruby-registration-history-tests.mjs"
];
let history;

/**
 * Reverse an exact set of nonoverlapping edits to one authenticated parent.
 *
 * @param source - Complete merged source text.
 * @param update - Authenticated immutable transition.
 * @param editsKey - Parent-specific edit collection.
 * @param digestKey - Parent-specific SHA-256 field.
 */
const reverseParent = (source, update, editsKey, digestKey) => {
	assert.ok(nominalPrimitiveSubtypeRubyIntegrationChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	const edits = update[editsKey];
	assert.ok(Array.isArray(edits) && edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const parent = parts.join("");
	assert.equal(sha256(parent), update[digestKey], update.path);
	return parent;
};

/**
 * Restore the exact first-parent source.
 *
 * @param source - Complete merged source text.
 * @param update - Authenticated immutable transition.
 */
export const reverseNominalPrimitiveSubtypeRubyIntegrationUpdate = (source, update) =>
	reverseParent(source, update, "edits", "previousSha256");

/**
 * Restore the exact Ruby-parent source when that path existed there.
 *
 * @param source - Complete merged source text.
 * @param update - Authenticated immutable transition.
 */
export const reverseNominalPrimitiveSubtypeRubyIntegrationAlternateUpdate = (source, update) =>
	reverseParent(source, update, "alternateEdits", "alternateSha256");

/**
 * Preserve unknown edits and select the exact requested merge parent.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete merged or historical source text.
 * @param expected - Optional requested stopping digest.
 */
export const beforeNominalPrimitiveSubtypeRubyIntegrationSource = (path, source, expected) => {
	source = beforeNominalPrimitiveSubtypePerlPromotionSource(path, source, expected);
	if(typeof source !== "string" || !nominalPrimitiveSubtypeRubyIntegrationChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeRubyIntegrationHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	if(update?.currentSha256 !== digest) return source;
	if(typeof expected === "string" && typeof update.alternateSha256 === "string")
	{
		const alternate = reverseNominalPrimitiveSubtypeRubyIntegrationAlternateUpdate(source, update);
		if(sha256(alternate) === expected) return alternate;
		const historical = beforeNominalPrimitiveSubtypeRubyRegistrationSource(path, alternate, expected);
		if(sha256(historical) === expected) return historical;
	}
	return typeof update.previousSha256 === "string"
		? reverseNominalPrimitiveSubtypeRubyIntegrationUpdate(source, update)
		: source;
};

/**
 * Restore only this milestone's exact current-source pins for earlier support checks.
 * Only exact current-to-first-parent digests recorded by the immutable ledger are reversed.
 *
 * @param inventory - Earlier inventory recomputed with current source hashes.
 */
export const beforeNominalPrimitiveSubtypeRubyIntegrationPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeRubyIntegrationHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};
