/**
 * Authenticate the exact primitive-base Python support and documentation transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalPrimitiveSubtypeBrowserRegistrationSource } from "./nominal-primitive-subtype-browser-registration-history.mjs";
import { beforeNominalPrimitiveSubtypeBrowserPromotionPins } from "./nominal-primitive-subtype-browser-promotion-history.mjs";

export const nominalPrimitiveSubtypePythonPromotionHistoryPath = "docs/evidence/nominal-primitive-subtype-python-promotion-source-history-20261014.json";
export const nominalPrimitiveSubtypePythonPromotionPredecessor = "b1be97044c7dd9f21f58c8b63bd6a4518c145f04";
export const nominalPrimitiveSubtypePythonPromotionChangedPaths = [
	"docs/consume/python.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-registration-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-registration-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-python-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-python-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse only a complete transition with exact before and after digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated immutable transition.
 */
export const reverseNominalPrimitiveSubtypePythonPromotionUpdate = (source, update) => {
	assert.ok(nominalPrimitiveSubtypePythonPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string"); assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous); cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Preserve unknown edits and stop at the explicitly requested historical epoch.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional requested stopping digest.
 */
export const beforeNominalPrimitiveSubtypePythonPromotionSource = (path, source, expected) => {
	source = beforeNominalPrimitiveSubtypeBrowserRegistrationSource(path, source, expected);
	if(typeof source !== "string" || !nominalPrimitiveSubtypePythonPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypePythonPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalPrimitiveSubtypePythonPromotionUpdate(source, update) : source;
};

/**
 * Restore only this milestone's exact current-source pins for earlier support checks.
 *
 * @param inventory - Earlier inventory recomputed with current source hashes.
 */
export const beforeNominalPrimitiveSubtypePythonPromotionPins = inventory => {
	const previous = beforeNominalPrimitiveSubtypeBrowserPromotionPins(inventory);
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypePythonPromotionHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};
