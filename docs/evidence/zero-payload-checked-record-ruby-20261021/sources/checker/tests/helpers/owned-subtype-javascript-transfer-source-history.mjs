/**
 * Reverse the authenticated retained and transferred JavaScript owned-Subtype
 * transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeJavaScriptTransferHistoryPath
	= "docs/evidence/owned-subtype-javascript-transfer-source-history-20261020.json";
export const ownedSubtypeJavaScriptTransferEvidencePath
	= "docs/evidence/owned-subtype-javascript-transfer-acceptance-20261020.json";
export const ownedSubtypeJavaScriptTransferPredecessor
	= "025597da0fdced0d2d1a60e04a78d9d2e502fcc4";
export const ownedSubtypeJavaScriptTransferImplementation
	= "c95b9ca0bcfcc5138cc50072a868dc37942291b4";
export const ownedSubtypeJavaScriptTransferChangedPaths = Object.freeze([
	"docs/javascript-typescript.md"
	, "docs/lean/diagnostics.md"
	, "docs/lean/existing-package.md"
	, "docs/type-surface.v1.json"
	, "src/build/owned-refinement-carriers.mjs"
	, "tests/fixtures/onboarding/owned-subtypes/Owned.lean"
	, "tests/fixtures/onboarding/owned-subtypes/lean-bridge.exports.json"
	, "tests/helpers/callback-subtype-foundation-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-native-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-npm-acceptance-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-npm-browser-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-remaining-acceptance-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-entry-measurement-source-history-tests.mjs"
	, "tests/helpers/owned-aggregate-fixture.mjs"
	, "tests/helpers/owned-refinement-carriers-source-history-tests.mjs"
	, "tests/helpers/owned-refinement-model-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-analysis-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-javascript-source-history-tests.mjs"
	, "tests/owned-aggregate-model.test.mjs"
	, "tests/owned-subtype-javascript-packaging.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeJavaScriptTransferHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeJavaScriptTransferUpdate = (source, update) => {
	assert.ok(ownedSubtypeJavaScriptTransferChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this exact retained/transferred JavaScript transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeJavaScriptTransferSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !ownedSubtypeJavaScriptTransferChangedPaths.includes(path))
			return source;
		const digest = sha256(source);
		if(digest === expected) return source;
		const update = record().updates.find(item => item.path === path);
		return update?.currentSha256 === digest
			? reverseOwnedSubtypeJavaScriptTransferUpdate(source, update) : source;
	};
