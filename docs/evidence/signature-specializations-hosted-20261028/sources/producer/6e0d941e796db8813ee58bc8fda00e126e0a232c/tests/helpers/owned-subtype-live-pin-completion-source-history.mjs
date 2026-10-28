/**
 * Preserve the exact owned Subtype live pin completion transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeLivePinCompletionHistoryPath
	= "docs/evidence/owned-subtype-live-pin-completion-source-history-20261023.json";
export const ownedSubtypeLivePinCompletionPredecessor
	= "15890d6204a756773943c46a6362b2428fdad78e";
export const ownedSubtypeLivePinCompletionImplementation
	= "ed99734e52c8dbdf4b3ccb37fd999c2be7875c66";
export const ownedSubtypeLivePinCompletionModifiedPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
	]);
export const ownedSubtypeLivePinCompletionIntegrationPaths
	= Object.freeze([
		"tests/checked-record-perl-acceptance.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const ownedSubtypeLivePinCompletionNormalizationPaths
	= Object.freeze([...new Set([
		...ownedSubtypeLivePinCompletionModifiedPaths
		, ...ownedSubtypeLivePinCompletionIntegrationPaths
	])]);
export const ownedSubtypeLivePinCompletionAddedPaths
	= Object.freeze([
		"scripts/update-owned-subtype-live-pin-completion-source-history.mjs"
		, "tests/helpers/owned-subtype-live-pin-completion-source-history-tests.mjs"
		, "tests/helpers/owned-subtype-live-pin-completion-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeLivePinCompletionHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseOwnedSubtypeLivePinCompletionUpdate = (source, update) => {
	assert.ok(ownedSubtypeLivePinCompletionNormalizationPaths.includes(update.path));
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
 * Remove one authenticated transition of this layer. A recognized update is
 * always reversed; the central hub decides where an expected historical
 * digest stops and re-enters for any further transition.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeOwnedSubtypeLivePinCompletionSource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !ownedSubtypeLivePinCompletionNormalizationPaths.includes(path)) return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOwnedSubtypeLivePinCompletionUpdate(source, update);
};
