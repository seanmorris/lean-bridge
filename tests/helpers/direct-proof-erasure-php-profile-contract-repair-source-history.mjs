/**
 * Preserve the direct proof-erasure PHP profile-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasurePhpProfileContractRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-php-profile-contract-repair-source-history-20261030.json";
export const directProofErasurePhpProfileContractRepairPredecessor
	= "492b3052fbf699a98623569c08e552a8259bfdf9";
export const directProofErasurePhpProfileContractRepairImplementation
	= "765beb22af6dae649ec5688c7eb547ed50015a39";
export const directProofErasurePhpProfileContractRepairImplementationPaths
	= Object.freeze([
		"tests/direct-proof-erasure-php-installed.test.mjs"
		, "tests/helpers/direct-proof-erasure-php-report.mjs"
		, "tests/helpers/direct-proof-erasure-php-tests.mjs"
	]);
export const directProofErasurePhpProfileContractRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasurePhpProfileContractRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-php-profile-contract-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-php-profile-contract-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-php-profile-contract-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasurePhpProfileContractRepairHistoryPath}`
	, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasurePhpProfileContractRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasurePhpProfileContractRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasurePhpProfileContractRepairImplementationPaths.includes(path)
	|| directProofErasurePhpProfileContractRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact PHP profile-contract repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasurePhpProfileContractRepairUpdate = (
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
 * Remove only the authenticated PHP profile-contract repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasurePhpProfileContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasurePhpProfileContractRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasurePhpProfileContractRepairUpdate(
				current, update
			);
	}
	return current;
};
