/**
 * Preserve the complete proof-erasure audit entry points.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureCompleteEntrypointsHistoryPath
	= "docs/evidence/direct-proof-erasure-complete-entrypoints-source-history-20261029.json";
export const directProofErasureCompleteEntrypointsPredecessor
	= "5a2014dcfdb59c8332031bf1dd44509a32dffb12";
export const directProofErasureCompleteEntrypointsImplementation
	= "3e9758fbba302ab3b2adf9048d069f3a0ff276d1";
export const directProofErasureCompleteEntrypointsImplementationPaths
	= Object.freeze([
		"tests/helpers/direct-proof-erasure-complete-promotion.mjs"
	]);
export const directProofErasureCompleteEntrypointsImplementationAdditions
	= Object.freeze([
		"tests/direct-proof-erasure-complete-hosted-evidence.test.mjs"
		, "tests/direct-proof-erasure-complete-promotion.test.mjs"
	]);
export const directProofErasureCompleteEntrypointsIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureCompleteEntrypointsHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-complete-entrypoints-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-complete-entrypoints-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-complete-entrypoints-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasureCompleteEntrypointsHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasureCompleteEntrypointsNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureCompleteEntrypointsImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasureCompleteEntrypointsImplementationPaths.includes(path)
	|| directProofErasureCompleteEntrypointsIntegrationPaths.includes(path);

/**
 * Reverse one authenticated entry-point transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseDirectProofErasureCompleteEntrypointsUpdate = (
	source, update
) => {
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
 * Remove the authenticated proof-erasure entry-point transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureCompleteEntrypointsSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureCompleteEntrypointsNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureCompleteEntrypointsUpdate(
				current, update);
	}
	return current;
};
