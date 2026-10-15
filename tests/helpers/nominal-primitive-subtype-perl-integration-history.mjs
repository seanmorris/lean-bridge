/**
 * Authenticate the merge of primitive-base Native and Perl support histories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalPrimitiveSubtypePerlIntegrationHistoryPath = "docs/evidence/nominal-primitive-subtype-perl-integration-source-history-20261015.json";
export const nominalPrimitiveSubtypePerlIntegrationPredecessor = "98c93399ac35fc69e9ee7a19e5b767625d4d5d21";
export const nominalPrimitiveSubtypePerlIntegrationAlternate = "acc614cd17981972b3f12307a94b0eef4a957fc5";
export const nominalPrimitiveSubtypePerlIntegrationChangedPaths = [
	"tests/helpers/core-quality-budget-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
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
	assert.ok(nominalPrimitiveSubtypePerlIntegrationChangedPaths.includes(update.path));
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
export const reverseNominalPrimitiveSubtypePerlIntegrationUpdate = (source, update) =>
	reverseParent(source, update, "edits", "previousSha256");

/**
 * Restore the exact Perl-parent source when that path existed there.
 *
 * @param source - Complete merged source text.
 * @param update - Authenticated immutable transition.
 */
export const reverseNominalPrimitiveSubtypePerlIntegrationAlternateUpdate = (source, update) =>
	reverseParent(source, update, "alternateEdits", "alternateSha256");

/**
 * Preserve unknown edits and select the exact requested merge parent.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete merged or historical source text.
 * @param expected - Optional requested stopping digest.
 */
export const beforeNominalPrimitiveSubtypePerlIntegrationSource = (path, source, expected) => {
	if(typeof source !== "string" || !nominalPrimitiveSubtypePerlIntegrationChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypePerlIntegrationHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	if(update?.currentSha256 !== digest) return source;
	return typeof update.alternateSha256 === "string" && expected === update.alternateSha256
		? reverseNominalPrimitiveSubtypePerlIntegrationAlternateUpdate(source, update)
		: reverseNominalPrimitiveSubtypePerlIntegrationUpdate(source, update);
};
