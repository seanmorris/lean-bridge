/**
 * Preserve the direct proof-erasure PHP receipt-identity repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasurePhpReceiptIdentityRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-php-receipt-identity-repair-source-history-20261030.json";
export const directProofErasurePhpReceiptIdentityRepairPredecessor
	= "2afde2c25a6b2ded4cc5c198e01e8a28114a9baf";
export const directProofErasurePhpReceiptIdentityRepairImplementation
	= "4cc1370b57abfe3869da72e5c65e8aab23d89da1";
export const directProofErasurePhpReceiptIdentityRepairImplementationPaths
	= Object.freeze([
		"tests/direct-proof-erasure.test.mjs"
		, "tests/helpers/direct-proof-erasure-packages.mjs"
	]);
export const directProofErasurePhpReceiptIdentityRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasurePhpReceiptIdentityRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-php-receipt-identity-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-php-receipt-identity-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-php-receipt-identity-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasurePhpReceiptIdentityRepairHistoryPath}`
	, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasurePhpReceiptIdentityRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasurePhpReceiptIdentityRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasurePhpReceiptIdentityRepairImplementationPaths.includes(path)
	|| directProofErasurePhpReceiptIdentityRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact PHP receipt-identity repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasurePhpReceiptIdentityRepairUpdate = (
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
 * Remove only the authenticated PHP receipt-identity repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasurePhpReceiptIdentityRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasurePhpReceiptIdentityRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasurePhpReceiptIdentityRepairUpdate(
				current, update
			);
	}
	return current;
};
