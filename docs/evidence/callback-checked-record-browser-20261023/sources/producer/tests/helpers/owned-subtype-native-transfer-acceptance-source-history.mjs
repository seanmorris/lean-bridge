/**
 * Reverse the native owned-Subtype transfer acceptance correction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeNativeTransferAcceptanceHistoryPath
	= "docs/evidence/owned-subtype-native-transfer-acceptance-source-history-20261021.json";
export const ownedSubtypeNativeTransferAcceptancePredecessor
	= "6d063783673068077fece2bcdd98009796ff67a9";
export const ownedSubtypeNativeTransferAcceptanceImplementation
	= "4b0639663021a03f70735a55ba5c027fff7ab348";
export const ownedSubtypeNativeTransferAcceptanceChangedPaths = Object.freeze([
	"tests/fixtures/structured-types/owned-subtype-installed.cpp"
	, "tests/owned-subtype-native-packaging.test.mjs"
]);
export const ownedSubtypeNativeTransferAcceptanceIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeNativeTransferAcceptanceHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact acceptance transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeNativeTransferAcceptanceUpdate = (source, update) => {
	assert.ok([...ownedSubtypeNativeTransferAcceptanceChangedPaths
		, ...ownedSubtypeNativeTransferAcceptanceIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only this acceptance correction from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeNativeTransferAcceptanceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...ownedSubtypeNativeTransferAcceptanceChangedPaths
			, ...ownedSubtypeNativeTransferAcceptanceIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseOwnedSubtypeNativeTransferAcceptanceUpdate(source, update)
		: source;
};
