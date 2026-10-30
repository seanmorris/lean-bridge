/**
 * Preserve the direct proof-erasure archive lane-identity repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureArchiveLaneIdentityRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-archive-lane-identity-repair-source-history-20261030.json";
export const directProofErasureArchiveLaneIdentityRepairPredecessor
	= "2d962826d80d66d00732f61f48489112913cb30c";
export const directProofErasureArchiveLaneIdentityRepairImplementation
	= "6efe6ac6f620d65da823e7cef6140d93c25e27a2";
export const directProofErasureArchiveLaneIdentityRepairImplementationPaths
	= Object.freeze([
		"scripts/archive-direct-proof-erasure-hosted.mjs"
		, "tests/helpers/direct-proof-erasure-hosted-archive-tests.mjs"
		, "tests/helpers/direct-proof-erasure-hosted-archive.mjs"
	]);
export const directProofErasureArchiveLaneIdentityRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureArchiveLaneIdentityRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-archive-lane-identity-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-archive-lane-identity-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-archive-lane-identity-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasureArchiveLaneIdentityRepairHistoryPath}`
	, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasureArchiveLaneIdentityRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureArchiveLaneIdentityRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasureArchiveLaneIdentityRepairImplementationPaths.includes(path)
	|| directProofErasureArchiveLaneIdentityRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact archive lane-identity repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasureArchiveLaneIdentityRepairUpdate = (
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
 * Remove only the authenticated archive lane-identity repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureArchiveLaneIdentityRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureArchiveLaneIdentityRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureArchiveLaneIdentityRepairUpdate(
				current, update
			);
	}
	return current;
};
