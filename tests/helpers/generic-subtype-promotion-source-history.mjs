/**
 * Preserve the exact closed generic-Subtype promotion-contract transition and
 * its live inventory pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypePromotionHistoryPath
	= "docs/evidence/generic-subtype-promotion-source-history-20261023.json";
export const genericSubtypePromotionPredecessor
	= "2c56a2823db0b4996ccb97e02140194d8ee9b5d3";
export const genericSubtypePromotionImplementation
	= "c05f3a140241d82b965f3dc0e2998fe0d3dd66bc";
export const genericSubtypePromotionModifiedPaths = Object.freeze([
	"tests/generic-subtype-native-perl.test.mjs"
]);
export const genericSubtypePromotionImplementationAddedPaths = Object.freeze([
	"scripts/promote-generic-subtype-evidence.mjs"
	, "tests/helpers/generic-subtype-promotion-tests.mjs"
	, "tests/helpers/generic-subtype-promotion.mjs"
]);
export const genericSubtypePromotionImplementationPaths = Object.freeze([
	...genericSubtypePromotionModifiedPaths
	, ...genericSubtypePromotionImplementationAddedPaths
]);
export const genericSubtypePromotionIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/generic-subtype-native-perl.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const genericSubtypePromotionNormalizationPaths = Object.freeze([
	...new Set([
		...genericSubtypePromotionModifiedPaths
		, ...genericSubtypePromotionIntegrationPaths
	])
]);
export const genericSubtypePromotionHistoryAddedPaths = Object.freeze([
	"scripts/update-generic-subtype-promotion-source-history.mjs"
	, "tests/helpers/generic-subtype-promotion-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-promotion-source-history.mjs"
]);
export const genericSubtypePromotionAddedPaths = Object.freeze([
	...genericSubtypePromotionImplementationAddedPaths
	, ...genericSubtypePromotionHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypePromotionHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseGenericSubtypePromotionUpdate = (source, update) => {
	assert.ok(genericSubtypePromotionNormalizationPaths.includes(update.path));
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
 * Remove one authenticated generic-Subtype promotion transition. A
 * recognized update is always reversed; the central hub owns stop decisions.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeGenericSubtypePromotionSource = (
	path, source, expected
) => {
	void expected;
	if(typeof source !== "string"
		|| !genericSubtypePromotionNormalizationPaths.includes(path))
		return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseGenericSubtypePromotionUpdate(source, update);
};
