/**
 * Preserve the direct proof-erasure npm semantic Binding IR repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureNpmSemanticIrRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-npm-semantic-ir-repair-source-history-20261030.json";
export const directProofErasureNpmSemanticIrRepairPredecessor
	= "546a591fada14110d20b410fef767e4583885f37";
export const directProofErasureNpmSemanticIrRepairImplementation
	= "0f8dfe27af5490d289eedebcad7e2badbfe1ef01";
export const directProofErasureNpmSemanticIrRepairImplementationPaths
	= Object.freeze([
		"tests/direct-proof-erasure-npm-installed.test.mjs"
		, "tests/helpers/direct-proof-erasure-npm-report-tests.mjs"
		, "tests/helpers/direct-proof-erasure-npm-report.mjs"
	]);
export const directProofErasureNpmSemanticIrRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureNpmSemanticIrRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-npm-semantic-ir-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-npm-semantic-ir-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-npm-semantic-ir-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasureNpmSemanticIrRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasureNpmSemanticIrRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureNpmSemanticIrRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasureNpmSemanticIrRepairImplementationPaths.includes(path)
	|| directProofErasureNpmSemanticIrRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact npm semantic-IR repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasureNpmSemanticIrRepairUpdate = (
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
 * Remove only the authenticated npm semantic-IR repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureNpmSemanticIrRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureNpmSemanticIrRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureNpmSemanticIrRepairUpdate(
				current, update
			);
	}
	return current;
};
