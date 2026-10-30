/**
 * Preserve the focused direct proof-erasure hosted archive contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureFocusedArchiveHistoryPath
	= "docs/evidence/direct-proof-erasure-focused-archive-source-history-20261030.json";
export const directProofErasureFocusedArchivePredecessor
	= "09ca211fec5fcebfd47747cd55485781adf93974";
export const directProofErasureFocusedArchiveImplementation
	= "ae0130afe02e26e37d43d852de9aef38405b7224";
export const directProofErasureFocusedArchiveChangedPaths = Object.freeze([
	"scripts/archive-direct-proof-erasure-hosted.mjs"
	, "scripts/download-direct-proof-erasure-hosted-inputs.mjs"
	, "scripts/generate-type-docs.mjs"
	, "tests/direct-proof-erasure-complete-hosted-evidence.test.mjs"
	, "tests/direct-proof-erasure-complete-promotion.test.mjs"
	, "tests/helpers/direct-proof-erasure-complete-documentation.mjs"
	, "tests/helpers/direct-proof-erasure-complete-promotion-tests.mjs"
	, "tests/helpers/direct-proof-erasure-complete-promotion.mjs"
	, "tests/helpers/direct-proof-erasure-hosted-archive-tests.mjs"
	, "tests/helpers/direct-proof-erasure-hosted-archive.mjs"
	, "tests/helpers/direct-proof-erasure-hosted-evidence.mjs"
]);
export const directProofErasureFocusedArchiveIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const directProofErasureFocusedArchiveHistoryAdditions = Object.freeze([
	"scripts/update-direct-proof-erasure-focused-archive-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-focused-archive-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-focused-archive-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${directProofErasureFocusedArchiveHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasureFocusedArchiveNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureFocusedArchiveChangedPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => directProofErasureFocusedArchiveChangedPaths
	.includes(path) || directProofErasureFocusedArchiveIntegrationPaths
	.includes(path);

/**
 * Reverse one exact focused archive-contract transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseDirectProofErasureFocusedArchiveUpdate = (
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
 * Remove only the authenticated focused archive transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureFocusedArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureFocusedArchiveNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureFocusedArchiveUpdate(
				current, update
			);
	}
	return current;
};
