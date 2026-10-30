/**
 * Preserve the exact language-closure checker repair for direct proof erasure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureLanguageClosureRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-language-closure-repair-source-history-20261030.json";
export const directProofErasureLanguageClosureRepairPredecessor
	= "88d798c290eede50a0b5310de4a1dbc4e24fd67f";
export const directProofErasureLanguageClosureRepairImplementation
	= "d3d26d78ac3a9ebd549e22b3f6097c970e9c4f1a";
export const directProofErasureLanguageClosureRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/direct-proof-erasure-language-report.mjs"
		, "tests/helpers/direct-proof-erasure-language-tests.mjs"
	]);
export const directProofErasureLanguageClosureRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureLanguageClosureRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-language-closure-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-language-closure-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-language-closure-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasureLanguageClosureRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasureLanguageClosureRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureLanguageClosureRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasureLanguageClosureRepairImplementationPaths.includes(path)
	|| directProofErasureLanguageClosureRepairIntegrationPaths.includes(path);

/**
 * Reverse one authenticated language-closure checker repair.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseDirectProofErasureLanguageClosureRepairUpdate
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
 * Remove only the authenticated language-closure checker repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureLanguageClosureRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureLanguageClosureRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureLanguageClosureRepairUpdate(
				current, update);
	}
	return current;
};
