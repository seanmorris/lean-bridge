/**
 * Recover the three type-surface transitions after HostNull JavaScript that no history layer records on the combined
 * lineage: d68fd8d managed pins, the 8577048 npm runtime default-value copy repair pins on those managed bytes, and
 * the 6cdc7a5 downstream pins; preserve this layer's own registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullTypeSurfaceLineageHistoryPath
	= "docs/evidence/host-null-type-surface-lineage-source-history-20261029.json";
export const hostNullTypeSurfaceLineagePredecessor
	= "6bcc2faf435d2b08b8cab7873ca65ec260836bf7";
export const hostNullTypeSurfaceLineagePath = "docs/type-surface.v1.json";
// First-parent commits that changed type-surface after HostNull JavaScript recorded it at 61baaf89: the
// managed pin refresh, the npm runtime default-value copy repair pins on those managed bytes, and the
// downstream pin refresh.
export const hostNullTypeSurfaceLineageCommits = Object.freeze([
	"d68fd8deb389ead51fbc6eda279c19fe85579bab"
	, "8577048de618566de12c9a3ccf9676c32bfc7cba"
	, "6cdc7a5e956987f9acf0a9c81dcca740d39c5d65"
]);
export const hostNullTypeSurfaceLineagePinCounts = Object.freeze([244, 16, 579]);
export const hostNullTypeSurfaceLineageAnchorSha256
	= "61baaf89d3bc0271410ce4dba23bbd8506c49bc1f7fb734d045db90b55fd0fdd";
export const hostNullTypeSurfaceLineageTargetSha256
	= "51338494b1c4d2d8d50d04149955a5ccd2c4fc317b1c274f0cea85f8c597e1aa";
export const hostNullTypeSurfaceLineageHistoricalPaths = Object.freeze([
	hostNullTypeSurfaceLineagePath
]);
export const hostNullTypeSurfaceLineageIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullTypeSurfaceLineageNormalizationPaths = Object.freeze([
	...new Set([...hostNullTypeSurfaceLineageHistoricalPaths, ...hostNullTypeSurfaceLineageIntegrationPaths])
]);
export const hostNullTypeSurfaceLineageAddedPaths = Object.freeze([
	"scripts/update-host-null-type-surface-lineage-source-history.mjs"
	, "tests/helpers/host-null-type-surface-lineage-source-history-tests.mjs"
	, "tests/helpers/host-null-type-surface-lineage-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostNullTypeSurfaceLineageHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete later source.
 * @param update - Path, both digests and the later-side edits of one change.
 */
export const reverseHostNullTypeSurfaceLineageUpdate = (source, update) => {
	assert.ok(hostNullTypeSurfaceLineageNormalizationPaths.includes(update.path));
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
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseHostNullTypeSurfaceLineageUpdate(current, update);
	}
	return current;
};

/**
 * Remove only this layer's own registration from the newest sources.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullTypeSurfaceLineageIntegrationSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !hostNullTypeSurfaceLineageIntegrationPaths.includes(path))
		return source;
	return walk(path, source, expected, record().integrationUpdates);
};

/**
 * Reverse the recovered type-surface transitions from the downstream pin state back to the state that HostNull
 * JavaScript recorded.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullTypeSurfaceLineageSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !hostNullTypeSurfaceLineageHistoricalPaths.includes(path))
		return source;
	return walk(path, source, expected, record().updates);
};
