/**
 * Preserve the direct proof-erasure managed receipt-profile repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureReceiptProfileRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-receipt-profile-repair-source-history-20261030.json";
export const directProofErasureReceiptProfileRepairPredecessor
	= "9f37284de4e3b576ebfeff5ee463aea77c7b8da3";
export const directProofErasureReceiptProfileRepairImplementation
	= "447808063fc48cc6a41b6b4a763f95fa59f9cc10";
export const directProofErasureReceiptProfileRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/direct-proof-erasure-matrix-receipt-tests.mjs"
		, "tests/helpers/direct-proof-erasure-matrix-receipt.mjs"
	]);
export const directProofErasureReceiptProfileRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureReceiptProfileRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-receipt-profile-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-receipt-profile-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-receipt-profile-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasureReceiptProfileRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasureReceiptProfileRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureReceiptProfileRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasureReceiptProfileRepairImplementationPaths.includes(path)
	|| directProofErasureReceiptProfileRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact managed receipt-profile repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasureReceiptProfileRepairUpdate = (
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
 * Remove only the authenticated managed receipt-profile repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureReceiptProfileRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureReceiptProfileRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureReceiptProfileRepairUpdate(
				current, update
			);
	}
	return current;
};
