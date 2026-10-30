/**
 * Preserve the direct proof-erasure npm author-route IR repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureNpmIrRouteRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-npm-ir-route-repair-source-history-20261030.json";
export const directProofErasureNpmIrRouteRepairPredecessor
	= "e3275c797d760957412254fb6be544dd55814c2d";
export const directProofErasureNpmIrRouteRepairImplementation
	= "dcb6f6635f4a6b2f3e03b7682afecefe22bb1139";
export const directProofErasureNpmIrRouteRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/direct-proof-erasure-npm-report-tests.mjs"
		, "tests/helpers/direct-proof-erasure-npm-report.mjs"
	]);
export const directProofErasureNpmIrRouteRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureNpmIrRouteRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-npm-ir-route-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-npm-ir-route-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-npm-ir-route-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasureNpmIrRouteRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasureNpmIrRouteRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureNpmIrRouteRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasureNpmIrRouteRepairImplementationPaths.includes(path)
	|| directProofErasureNpmIrRouteRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact npm route repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasureNpmIrRouteRepairUpdate = (
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
 * Remove only the authenticated npm author-route repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureNpmIrRouteRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureNpmIrRouteRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureNpmIrRouteRepairUpdate(
				current, update
			);
	}
	return current;
};
