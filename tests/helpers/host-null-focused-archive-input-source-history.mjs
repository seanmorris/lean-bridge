/**
 * Preserve focused HostNull hosted-input acquisition and selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullFocusedArchiveInputHistoryPath
	= "docs/evidence/host-null-focused-archive-input-source-history-20261029.json";
export const hostNullFocusedArchiveInputPredecessor
	= "8777a819eff57bf63455e6f26cdb3e81fab1955a";
export const hostNullFocusedArchiveInputImplementation
	= "7f6f130f7d7b2859d527f90c2c22956537f6b6a5";
export const hostNullFocusedArchiveInputImplementationPaths = Object.freeze([
	"scripts/download-host-null-complete-inputs.mjs"
	, "tests/helpers/host-null-complete-hosted-archive-tests.mjs"
	, "tests/helpers/host-null-complete-hosted-archive.mjs"
]);
export const hostNullFocusedArchiveInputIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullFocusedArchiveInputHistoryAdditions = Object.freeze([
	"scripts/update-host-null-focused-archive-input-source-history.mjs"
	, "tests/helpers/host-null-focused-archive-input-source-history-tests.mjs"
	, "tests/helpers/host-null-focused-archive-input-source-history.mjs"
]);

const historyUrl = new URL(`../../${hostNullFocusedArchiveInputHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const hostNullFocusedArchiveInputNormalizationPaths = Object.freeze([
	...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: hostNullFocusedArchiveInputImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])
].sort());
const allowedPath = path => hostNullFocusedArchiveInputImplementationPaths
	.includes(path) || hostNullFocusedArchiveInputIntegrationPaths.includes(path);

/**
 * Reverse one exact focused-archive transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseHostNullFocusedArchiveInputUpdate = (source, update) => {
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
 * Remove focused archive integration and implementation transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeHostNullFocusedArchiveInputSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !hostNullFocusedArchiveInputNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHostNullFocusedArchiveInputUpdate(current, update);
	}
	return current;
};
