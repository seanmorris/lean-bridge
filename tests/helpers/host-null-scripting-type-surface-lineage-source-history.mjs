/**
 * Preserve the exact scripting HostNull type-surface pin transition and this
 * layer's newest-first registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullScriptingTypeSurfaceHistoryPath
	= "docs/evidence/host-null-scripting-type-surface-lineage-source-history-20261029.json";
export const hostNullScriptingTypeSurfacePredecessor
	= "50f0fb076f59160ad4fda0a28732ea2c6796b1eb";
export const hostNullScriptingTypeSurfacePath = "docs/type-surface.v1.json";
export const hostNullScriptingTypeSurfacePinDefinition
	= "93b58511f787ff41aef626c4a046907519022e36";
export const hostNullScriptingTypeSurfacePinRefresh
	= "7075578b6fc2f3ff497a42d308872ef351004512";
export const hostNullScriptingTypeSurfaceAnchorSha256
	= "51338494b1c4d2d8d50d04149955a5ccd2c4fc317b1c274f0cea85f8c597e1aa";
export const hostNullScriptingTypeSurfaceTargetSha256
	= "4a2f092fc89451b1692c3ea546910acb5d6ab793f1f45f928a688e83f8c32865";
export const hostNullScriptingTypeSurfacePinCount = 115;
export const hostNullScriptingTypeSurfaceIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullScriptingTypeSurfaceNormalizationPaths = Object.freeze([
	hostNullScriptingTypeSurfacePath
	, ...hostNullScriptingTypeSurfaceIntegrationPaths
]);
export const hostNullScriptingTypeSurfaceAddedPaths = Object.freeze([
	"scripts/update-host-null-scripting-type-surface-lineage-source-history.mjs"
	, "tests/helpers/host-null-scripting-type-surface-lineage-source-history-tests.mjs"
	, "tests/helpers/host-null-scripting-type-surface-lineage-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostNullScriptingTypeSurfaceHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated scripting type-surface transition.
 *
 * @param source - Complete later source.
 * @param update - Path, digests and later-side edits of one change.
 */
export const reverseHostNullScriptingTypeSurfaceUpdate = (source, update) => {
	assert.ok(hostNullScriptingTypeSurfaceNormalizationPaths.includes(update.path));
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

const walk = (path, source, expected, updates) => {
	if(typeof source !== "string"
		|| !hostNullScriptingTypeSurfaceNormalizationPaths.includes(path)) return source;
	let current = source;
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseHostNullScriptingTypeSurfaceUpdate(current, update);
	}
};

/**
 * Remove only this layer's newest-first registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullScriptingTypeSurfaceIntegrationSource
	= (path, source, expected) => walk(
		path, source, expected, record().integrationUpdates);

/**
 * Restore the scripting HostNull pin refresh to its authenticated predecessor.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullScriptingTypeSurfaceSource
	= (path, source, expected) => walk(path, source, expected, record().updates);
