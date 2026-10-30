/**
 * Preserve the direct proof-erasure npm route-binder repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureNpmRouteBinderRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-npm-route-binder-repair-source-history-20261030.json";
export const directProofErasureNpmRouteBinderRepairPredecessor
	= "8eee10b334e93181814be61eb34e6e041946b8f0";
export const directProofErasureNpmRouteBinderRepairImplementation
	= "1f9651a332c9e1837acbff3e9f3af23d0b7cb5c6";
export const directProofErasureNpmRouteBinderRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/direct-proof-erasure-packages.mjs"
	]);
export const directProofErasureNpmRouteBinderRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureNpmRouteBinderRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-npm-route-binder-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-npm-route-binder-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-npm-route-binder-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasureNpmRouteBinderRepairHistoryPath}`
	, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasureNpmRouteBinderRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureNpmRouteBinderRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasureNpmRouteBinderRepairImplementationPaths.includes(path)
	|| directProofErasureNpmRouteBinderRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact npm route-binder repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasureNpmRouteBinderRepairUpdate = (
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
 * Remove only the authenticated npm route-binder repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureNpmRouteBinderRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureNpmRouteBinderRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureNpmRouteBinderRepairUpdate(
				current, update
			);
	}
	return current;
};
