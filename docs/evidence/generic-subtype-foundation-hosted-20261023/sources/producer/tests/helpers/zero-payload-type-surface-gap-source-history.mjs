/**
 * Restore the two type-surface transitions omitted by the zero-payload Python
 * and Ruby history layers. Each transition is reconstructed from exact Git
 * blobs; no historical record is rewritten.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadTypeSurfaceGapHistoryPath
	= "docs/evidence/zero-payload-type-surface-gap-source-history-20261021.json";
export const zeroPayloadTypeSurfaceGapPredecessor
	= "fb0e66e9739ebf7990b05800c2046ea91ac72f8e";
export const zeroPayloadTypeSurfaceGapHistoricalPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const zeroPayloadTypeSurfaceGapIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-fin-containers.test.mjs"
]);
export const zeroPayloadTypeSurfaceGapAddedPaths = Object.freeze([
	"scripts/update-zero-payload-type-surface-gap-source-history.mjs"
	, "tests/helpers/zero-payload-type-surface-gap-source-history-tests.mjs"
	, "tests/helpers/zero-payload-type-surface-gap-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadTypeSurfaceGapHistoryPath, "utf8"));

const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
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
 * Reverse one exact repair-integration transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition.
 */
export const reverseZeroPayloadTypeSurfaceGapIntegration = (source, update) =>
	reverse(source, update, zeroPayloadTypeSurfaceGapIntegrationPaths);
/**
 * Reverse one exact omitted historical transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition.
 */
export const reverseZeroPayloadTypeSurfaceGapHistorical = (source, update) =>
	reverse(source, update, zeroPayloadTypeSurfaceGapHistoricalPaths);

/**
 * Reverse the repair integration and then every contiguous omitted historical
 * transition, stopping at an optional exact digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which reconstruction stops.
 */
export const beforeZeroPayloadTypeSurfaceGapSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	if(zeroPayloadTypeSurfaceGapIntegrationPaths.includes(path))
	{
		const update = record().integrationUpdates.find(item => item.path === path);
		if(update?.currentSha256 === digest)
		{
			source = reverseZeroPayloadTypeSurfaceGapIntegration(source, update);
			digest = sha256(source);
			if(digest === expected) return source;
		}
	}
	if(!zeroPayloadTypeSurfaceGapHistoricalPaths.includes(path)) return source;
	while(true)
	{
		const update = record().historicalTransitions.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(!update) return source;
		source = reverseZeroPayloadTypeSurfaceGapHistorical(source, update);
		digest = sha256(source);
		if(digest === expected) return source;
	}
};
