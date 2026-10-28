/**
 * Reverse the generic Subtype managed TAP escape repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeManagedTapEscapeRepairHistoryPath
	= "docs/evidence/generic-subtype-managed-tap-escape-repair-source-history-20261024.json";
export const genericSubtypeManagedTapEscapeRepairPredecessor
	= "aeea35aee8eccaafa115de62b124f2aa711e16b5";
export const genericSubtypeManagedTapEscapeRepairImplementation
	= "be59a48e636f91d67874a831559e881fadf4a1f2";
export const genericSubtypeManagedTapEscapeRepairChangedPaths = Object.freeze([
	"tests/helpers/generic-subtype-managed-wit-report.mjs"
	, "tests/helpers/generic-subtype-managed-wit-tests.mjs"
]);
export const genericSubtypeManagedTapEscapeRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const genericSubtypeManagedTapEscapeRepairNormalizationPaths
	= Object.freeze([
		...genericSubtypeManagedTapEscapeRepairChangedPaths
		, ...genericSubtypeManagedTapEscapeRepairIntegrationPaths
	]);
export const genericSubtypeManagedTapEscapeRepairAddedPaths = Object.freeze([
	"scripts/update-generic-subtype-managed-tap-escape-repair-source-history.mjs"
	, "tests/helpers/generic-subtype-managed-tap-escape-repair-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-managed-tap-escape-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeManagedTapEscapeRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reverseGenericSubtypeManagedTapEscapeRepairUpdate = (
	source, update
) => {
	assert.ok(genericSubtypeManagedTapEscapeRepairNormalizationPaths
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
 * Remove only the exact generic Subtype managed TAP escape repair.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeGenericSubtypeManagedTapEscapeRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !genericSubtypeManagedTapEscapeRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseGenericSubtypeManagedTapEscapeRepairUpdate(source, update);
};
