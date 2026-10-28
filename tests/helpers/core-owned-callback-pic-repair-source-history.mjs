/**
 * Preserve the exact owned callback PIC repair and its central history
 * registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreOwnedCallbackPicRepairHistoryPath
	= "docs/evidence/core-owned-callback-pic-repair-source-history-20261028.json";
export const coreOwnedCallbackPicRepairPredecessor
	= "54380e2cff2d45338887a0a6d1aded0698e04f50";
export const coreOwnedCallbackPicRepairImplementation
	= "6a81789b2c7e24554f4ea5dee805385f29d0b3b9";
export const coreOwnedCallbackPicRepairCommits = Object.freeze([
	coreOwnedCallbackPicRepairImplementation
]);
export const coreOwnedCallbackPicRepairImplementationPaths = Object.freeze([
	"tests/helpers/owned-aggregate-native.mjs"
]);
export const coreOwnedCallbackPicRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreOwnedCallbackPicRepairNormalizationPaths = Object.freeze([
	...coreOwnedCallbackPicRepairImplementationPaths
	, ...coreOwnedCallbackPicRepairIntegrationPaths
]);
export const coreOwnedCallbackPicRepairAddedPaths = Object.freeze([
	"scripts/update-core-owned-callback-pic-repair-source-history.mjs"
	, "tests/helpers/core-owned-callback-pic-repair-source-history-tests.mjs"
	, "tests/helpers/core-owned-callback-pic-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreOwnedCallbackPicRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseCoreOwnedCallbackPicRepairUpdate = (source, update) => {
	assert.ok(coreOwnedCallbackPicRepairNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the recognized callback PIC repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreOwnedCallbackPicRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreOwnedCallbackPicRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreOwnedCallbackPicRepairUpdate(current, update);
	}
	return current;
};
