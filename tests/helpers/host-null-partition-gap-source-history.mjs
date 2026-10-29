/**
 * Recover the six checked-JavaScript partition 11 transitions that the HostNull PHP and promotion commits made
 * after the HostNull JavaScript integration without recording them, and preserve this layer's own registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullPartitionGapHistoryPath
	= "docs/evidence/host-null-partition-gap-source-history-20261029.json";
export const hostNullPartitionGapPredecessor
	= "9a333bafef6b77c112d4f36c40d45a439dfae84e";
export const hostNullPartitionGapPath = "tests/checked-javascript-partition-11.test.mjs";
// First-parent commits that changed partition 11 after HostNull JavaScript recorded it at c2d430c2.
export const hostNullPartitionGapCommits = Object.freeze([
	"fbcaebecd909439a524a01f4860ae81e14e53492"
	, "d215a3700a02de89a139b7ef4243c2b191367c34"
	, "68c4b2df7ad24c07b4c63e1a77159844f4af6a78"
	, "acbedcb054c2afc41e821c9af0d7c16a88eebd8b"
	, "c890fa905a7aaf795134621597ce02b3a51bf61e"
	, "806b4c3a3aeac87d8cf85c4cea3f6aac395d071c"
]);
export const hostNullPartitionGapAnchorSha256
	= "c2d430c26cef1cfd214a28f164ca51bb4e035133b1df483b71b6699cf504de57";
export const hostNullPartitionGapTargetSha256
	= "51f2e177132f98681d4d52853c15fef97c4c34c6fe2f391639b1f076130b6455";
export const hostNullPartitionGapHistoricalPaths = Object.freeze([hostNullPartitionGapPath]);
export const hostNullPartitionGapIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullPartitionGapNormalizationPaths = Object.freeze([
	...new Set([...hostNullPartitionGapHistoricalPaths, ...hostNullPartitionGapIntegrationPaths])
]);
export const hostNullPartitionGapAddedPaths = Object.freeze([
	"scripts/update-host-null-partition-gap-source-history.mjs"
	, "tests/helpers/host-null-partition-gap-source-history-tests.mjs"
	, "tests/helpers/host-null-partition-gap-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostNullPartitionGapHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete later source.
 * @param update - Path, both digests and the later-side edits of one change.
 */
export const reverseHostNullPartitionGapUpdate = (source, update) => {
	assert.ok(hostNullPartitionGapNormalizationPaths.includes(update.path));
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
		current = reverseHostNullPartitionGapUpdate(current, update);
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
export const beforeHostNullPartitionGapIntegrationSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !hostNullPartitionGapIntegrationPaths.includes(path))
		return source;
	return walk(path, source, expected, record().integrationUpdates);
};

/**
 * Reverse the recovered partition 11 transitions from the HostNull PHP promotion state back to the state
 * that HostNull JavaScript recorded.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullPartitionGapSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !hostNullPartitionGapHistoricalPaths.includes(path))
		return source;
	return walk(path, source, expected, record().updates);
};
