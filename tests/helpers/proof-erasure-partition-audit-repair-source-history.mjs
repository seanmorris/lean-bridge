/**
 * Preserve the proof-erasure partition audit repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const proofErasurePartitionAuditRepairHistoryPath
	= "docs/evidence/proof-erasure-partition-audit-repair-source-history-20261030.json";
export const proofErasurePartitionAuditRepairPredecessor
	= "0db40421feb4b02bc8ba74553585684e142d2d98";
export const proofErasurePartitionAuditRepairImplementation
	= "a89453bb46b26666543508a2bd713854fe8101d0";
export const proofErasurePartitionAuditRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/optional-parameter-complete-documentation-tests.mjs"
		, "tests/helpers/optional-parameter-complete-promotion-tests.mjs"
	]);
export const proofErasurePartitionAuditRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const proofErasurePartitionAuditRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-proof-erasure-partition-audit-repair-source-history.mjs"
		, "tests/helpers/proof-erasure-partition-audit-repair-source-history-tests.mjs"
		, "tests/helpers/proof-erasure-partition-audit-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${proofErasurePartitionAuditRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const proofErasurePartitionAuditRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: proofErasurePartitionAuditRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	proofErasurePartitionAuditRepairImplementationPaths.includes(path)
	|| proofErasurePartitionAuditRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact partition audit repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseProofErasurePartitionAuditRepairUpdate = (
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
 * Remove only the authenticated partition audit repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeProofErasurePartitionAuditRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !proofErasurePartitionAuditRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseProofErasurePartitionAuditRepairUpdate(
				current, update
			);
	}
	return current;
};
