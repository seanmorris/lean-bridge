/**
 * Authenticate full and result-only owned checked-record carrier compilation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedCarrierCompilationHistoryPath
	= "docs/evidence/owned-checked-carrier-compilation-source-history-20261025.json";
export const ownedCheckedCarrierCompilationPredecessor
	= "57c92b462a91d0384273bf7e152bb416061613d6";
export const ownedCheckedCarrierCompilationImplementation
	= "8d6aebd031f916f4ee0d2e0bd73fdaea3fef2413";
export const ownedCheckedCarrierCompilationIntegrationBase
	= "8d6aebd031f916f4ee0d2e0bd73fdaea3fef2413";
export const ownedCheckedCarrierCompilationCommits = Object.freeze([
	"8d6aebd031f916f4ee0d2e0bd73fdaea3fef2413"
]);
export const ownedCheckedCarrierCompilationChangedPaths = Object.freeze([
	".github/workflows/owned-checked-record-native-perl.yml"
	, "docs/type-surface.v1.json"
	, "tests/owned-checked-record-foundation.test.mjs"
]);
export const ownedCheckedCarrierCompilationImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-carrier-compilation-20261025.json"
]);
export const ownedCheckedCarrierCompilationImplementationPaths = Object.freeze([
	...ownedCheckedCarrierCompilationChangedPaths
	, ...ownedCheckedCarrierCompilationImplementationAddedPaths
]);
export const ownedCheckedCarrierCompilationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/owned-checked-record-foundation-source-history-tests.mjs"
]);
export const ownedCheckedCarrierCompilationNormalizationPaths = Object.freeze([
	...ownedCheckedCarrierCompilationChangedPaths
	, ...ownedCheckedCarrierCompilationIntegrationPaths
]);
export const ownedCheckedCarrierCompilationHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-carrier-compilation-source-history.mjs"
	, "tests/helpers/owned-checked-carrier-compilation-source-history-tests.mjs"
	, "tests/helpers/owned-checked-carrier-compilation-source-history.mjs"
]);
export const ownedCheckedCarrierCompilationAddedPaths = Object.freeze([
	...ownedCheckedCarrierCompilationImplementationAddedPaths
	, ...ownedCheckedCarrierCompilationHistoryAddedPaths
]);
export const ownedCheckedCarrierCompilationPins = Object.freeze([
	Object.freeze({
		path: ".github/workflows/owned-checked-record-native-perl.yml", count: 0
		, previousSha256: "ec209fe817265091e0d2d90179ed2deed2d2afb6d5412cfebeba50177a51408f"
		, currentSha256: "e625220f8e5aedf30b9986231cd0e63750231eed51a2136c041fef7d3c04da4c"
	})
	, Object.freeze({
		path: "tests/owned-checked-record-foundation.test.mjs", count: 4
		, previousSha256: "e8242f8dcca2562ef4fdadfe8da7a9072ec3022e33083c1c88bba8b69ff130c1"
		, currentSha256: "c6a2a1fc68d52658a56bbc0eb925f6993c20a323b9feb8c8fcfeab497ab82569"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedCarrierCompilationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedCarrierCompilationUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedCarrierCompilationNormalizationPaths
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
 * Remove only the exact Owned checked carrier compilation.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedCarrierCompilationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedCarrierCompilationNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedCheckedCarrierCompilationUpdate(current, update);
	}
	return current;
};
