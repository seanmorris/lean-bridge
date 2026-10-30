/**
 * Preserve the direct proof-erasure npm declaration-syntax repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureNpmDeclarationSyntaxRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-npm-declaration-syntax-repair-source-history-20261030.json";
export const directProofErasureNpmDeclarationSyntaxRepairPredecessor
	= "16663000d2e325b75c0f68c7b7049e188c78a101";
export const directProofErasureNpmDeclarationSyntaxRepairImplementation
	= "82f5201f3f0f3a19886328a1667717890e8cd098";
export const directProofErasureNpmDeclarationSyntaxRepairImplementationPaths
	= Object.freeze([
		"tests/direct-proof-erasure-npm-installed.test.mjs"
		, "tests/helpers/direct-proof-erasure-npm-report.mjs"
	]);
export const directProofErasureNpmDeclarationSyntaxRepairImplementationAdditions
	= Object.freeze([
		"tests/helpers/direct-proof-erasure-npm-report-tests.mjs"
	]);
export const directProofErasureNpmDeclarationSyntaxRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureNpmDeclarationSyntaxRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-npm-declaration-syntax-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-npm-declaration-syntax-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-npm-declaration-syntax-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasureNpmDeclarationSyntaxRepairHistoryPath}`
	, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasureNpmDeclarationSyntaxRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureNpmDeclarationSyntaxRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasureNpmDeclarationSyntaxRepairImplementationPaths.includes(path)
	|| directProofErasureNpmDeclarationSyntaxRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact npm declaration-syntax repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasureNpmDeclarationSyntaxRepairUpdate = (
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
 * Remove only the authenticated npm declaration-syntax repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureNpmDeclarationSyntaxRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureNpmDeclarationSyntaxRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureNpmDeclarationSyntaxRepairUpdate(
				current, update
			);
	}
	return current;
};
