/**
 * Preserve the direct proof-erasure npm declaration route-name repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureNpmDeclarationRouteRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-npm-declaration-route-repair-source-history-20261030.json";
export const directProofErasureNpmDeclarationRouteRepairPredecessor
	= "0938c6e07b9beb2c64cf90e157f63f5db2d89b0a";
export const directProofErasureNpmDeclarationRouteRepairImplementation
	= "26a52c3e811a9bb0761a28a6018ec13b14053a11";
export const directProofErasureNpmDeclarationRouteRepairImplementationPaths
	= Object.freeze([
		"tests/direct-proof-erasure-npm-installed.test.mjs"
	]);
export const directProofErasureNpmDeclarationRouteRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureNpmDeclarationRouteRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-npm-declaration-route-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-npm-declaration-route-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-npm-declaration-route-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasureNpmDeclarationRouteRepairHistoryPath}`
	, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasureNpmDeclarationRouteRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureNpmDeclarationRouteRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasureNpmDeclarationRouteRepairImplementationPaths.includes(path)
	|| directProofErasureNpmDeclarationRouteRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact npm declaration route-name repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasureNpmDeclarationRouteRepairUpdate = (
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
 * Remove only the authenticated npm declaration route-name repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureNpmDeclarationRouteRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureNpmDeclarationRouteRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureNpmDeclarationRouteRepairUpdate(
				current, update
			);
	}
	return current;
};
