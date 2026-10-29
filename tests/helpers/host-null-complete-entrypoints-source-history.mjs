/**
 * Preserve the complete HostNull audit entry points and shared source pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullCompleteEntrypointsHistoryPath
	= "docs/evidence/host-null-complete-entrypoints-source-history-20261029.json";
export const hostNullCompleteEntrypointsPredecessor
	= "eba52f04ab0a6106b91e98b9577ed148195a9393";
export const hostNullCompleteEntrypointsImplementation
	= "2ae2d8b78facab66713faa26940d2612982b97f9";
export const hostNullCompleteEntrypointsImplementationPaths = Object.freeze([
	"tests/helpers/host-null-complete-promotion-tests.mjs"
	, "tests/helpers/host-null-complete-promotion.mjs"
]);
export const hostNullCompleteEntrypointsImplementationAdditions = Object.freeze([
	"tests/host-null-complete-hosted-evidence.test.mjs"
	, "tests/host-null-complete-promotion.test.mjs"
]);
export const hostNullCompleteEntrypointsIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullCompleteEntrypointsHistoryAdditions = Object.freeze([
	"scripts/update-host-null-complete-entrypoints-source-history.mjs"
	, "tests/helpers/host-null-complete-entrypoints-source-history-tests.mjs"
	, "tests/helpers/host-null-complete-entrypoints-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${hostNullCompleteEntrypointsHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const hostNullCompleteEntrypointsNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: hostNullCompleteEntrypointsImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => hostNullCompleteEntrypointsImplementationPaths
	.includes(path) || hostNullCompleteEntrypointsIntegrationPaths.includes(path);

/**
 * Reverse one authenticated HostNull entry-point transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseHostNullCompleteEntrypointsUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), [
			"current", "previous", "start"
		]);
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
 * Remove the authenticated HostNull entry-point transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHostNullCompleteEntrypointsSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !hostNullCompleteEntrypointsNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHostNullCompleteEntrypointsUpdate(current, update);
	}
	return current;
};
