/**
 * Preserve the final live-only VO #1220 zero-gap assertion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220LiveZeroGapHistoryPath
	= "docs/evidence/vo1220-live-zero-gap-source-history-20261030.json";
export const vo1220LiveZeroGapPredecessor
	= "c26629e8f70f2944883658ef757bf47167ba9bfa";
export const vo1220LiveZeroGapImplementation
	= "d8dc5300ec7cbd740facf363539757598821a6d0";
export const vo1220LiveZeroGapImplementationPaths = Object.freeze([
	"tests/helpers/vo1220-zero-gap-tests.mjs"
]);
export const vo1220LiveZeroGapIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220LiveZeroGapHistoryAdditions = Object.freeze([
	"scripts/update-vo1220-live-zero-gap-source-history.mjs"
	, "tests/helpers/vo1220-live-zero-gap-source-history-tests.mjs"
	, "tests/helpers/vo1220-live-zero-gap-source-history.mjs"
]);

const historyUrl = new URL(`../../${vo1220LiveZeroGapHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220LiveZeroGapNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220LiveZeroGapImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => vo1220LiveZeroGapImplementationPaths.includes(path)
	|| vo1220LiveZeroGapIntegrationPaths.includes(path);

/**
 * Reverse one exact live-only zero-gap transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseVo1220LiveZeroGapUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
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
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated live-only zero-gap assertion.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeVo1220LiveZeroGapSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !vo1220LiveZeroGapNormalizationPaths.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220LiveZeroGapUpdate(current, update);
	}
	return current;
};
