/**
 * Preserve the combined PHP profile evidence repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasurePhpProfileRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-php-profile-repair-source-history-20261030.json";
export const directProofErasurePhpProfileRepairPredecessor
	= "76c39b25f013e5fa516e57d055a212bc42f52d0c";
export const directProofErasurePhpProfileRepairImplementation
	= "482e2960c91b84cde50bd5402ccd609ed8fe84ab";
export const directProofErasurePhpProfileRepairImplementationPaths
	= Object.freeze([
		"tests/direct-proof-erasure-php-installed.test.mjs"
		, "tests/helpers/direct-proof-erasure-packages.mjs"
		, "tests/helpers/direct-proof-erasure-php-report.mjs"
		, "tests/helpers/direct-proof-erasure-php-tests.mjs"
	]);
export const directProofErasurePhpProfileRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasurePhpProfileRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-php-profile-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-php-profile-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-php-profile-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasurePhpProfileRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasurePhpProfileRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasurePhpProfileRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasurePhpProfileRepairImplementationPaths.includes(path)
	|| directProofErasurePhpProfileRepairIntegrationPaths.includes(path);

/**
 * Reverse one authenticated PHP profile repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseDirectProofErasurePhpProfileRepairUpdate
	= (source, update) => {
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
 * Remove only the authenticated PHP profile repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasurePhpProfileRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasurePhpProfileRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasurePhpProfileRepairUpdate(
				current, update);
	}
	return current;
};
