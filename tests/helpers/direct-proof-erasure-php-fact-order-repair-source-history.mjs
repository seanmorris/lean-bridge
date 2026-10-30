/**
 * Preserve the direct proof-erasure PHP fact-order repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasurePhpFactOrderRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-php-fact-order-repair-source-history-20261030.json";
export const directProofErasurePhpFactOrderRepairPredecessor
	= "0787b0abce6ef7d14cebc7e59a7200b18f1a7773";
export const directProofErasurePhpFactOrderRepairImplementation
	= "67a5be7b2419e65405b3e42f1359d180b848f1f6";
export const directProofErasurePhpFactOrderRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/direct-proof-erasure-php-report.mjs"
		, "tests/helpers/direct-proof-erasure-php-tests.mjs"
	]);
export const directProofErasurePhpFactOrderRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasurePhpFactOrderRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-php-fact-order-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-php-fact-order-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-php-fact-order-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasurePhpFactOrderRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasurePhpFactOrderRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasurePhpFactOrderRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasurePhpFactOrderRepairImplementationPaths.includes(path)
	|| directProofErasurePhpFactOrderRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact PHP fact-order repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasurePhpFactOrderRepairUpdate = (
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
 * Remove only the authenticated PHP fact-order repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasurePhpFactOrderRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasurePhpFactOrderRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasurePhpFactOrderRepairUpdate(
				current, update
			);
	}
	return current;
};
