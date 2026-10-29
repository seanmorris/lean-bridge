/**
 * Preserve the copy-free transactional archive publication milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const largeEvidenceTransactionHistoryPath
	= "docs/evidence/large-evidence-transaction-source-history-20261029.json";
export const largeEvidenceTransactionPredecessor
	= "1fcff01cda6ef081c56936ac66aa848ee8f8a87f";
export const largeEvidenceTransactionImplementation
	= "5627693e8ba57f0a8df7a48969893c1225bff6f6";
export const largeEvidenceTransactionImplementationPaths = Object.freeze([
	"scripts/archive-dependent-signature-hosted.mjs"
	, "scripts/archive-direct-proof-erasure-hosted.mjs"
	, "tests/checked-javascript-partition-11.test.mjs"
]);
export const largeEvidenceTransactionImplementationAdditions = Object.freeze([
	"src/capsule/transactional-directory.mjs"
	, "tests/helpers/transactional-directory-tests.mjs"
]);
export const largeEvidenceTransactionIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const largeEvidenceTransactionHistoryAdditions = Object.freeze([
	"scripts/update-large-evidence-transaction-source-history.mjs"
	, "tests/helpers/large-evidence-transaction-source-history-tests.mjs"
	, "tests/helpers/large-evidence-transaction-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${largeEvidenceTransactionHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const largeEvidenceTransactionNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: largeEvidenceTransactionImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => largeEvidenceTransactionImplementationPaths
	.includes(path) || largeEvidenceTransactionIntegrationPaths.includes(path);

/**
 * Reverse one authenticated large-archive transaction transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseLargeEvidenceTransactionUpdate = (source, update) => {
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
 * Remove authenticated transaction transitions, newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeLargeEvidenceTransactionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !largeEvidenceTransactionNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseLargeEvidenceTransactionUpdate(current, update);
	}
	return current;
};
