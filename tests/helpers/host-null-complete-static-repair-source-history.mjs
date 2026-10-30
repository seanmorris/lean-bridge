/**
 * Preserve the complete HostNull verifier lint and live-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullCompleteStaticRepairHistoryPath
	= "docs/evidence/host-null-complete-static-repair-source-history-20261030.json";
export const hostNullCompleteStaticRepairPredecessor
	= "fba471f1f927f02a5af9045c9c977234fe765c45";
export const hostNullCompleteStaticRepairImplementation
	= "c03b2365e3e6f8536e499ee2dc1a1a46441a56c7";
export const hostNullCompleteStaticRepairImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/host-null-complete-hosted-evidence.mjs"
]);
export const hostNullCompleteStaticRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullCompleteStaticRepairHistoryAdditions = Object.freeze([
	"scripts/update-host-null-complete-static-repair-source-history.mjs"
	, "tests/helpers/host-null-complete-static-repair-source-history-tests.mjs"
	, "tests/helpers/host-null-complete-static-repair-source-history.mjs"
]);

const historyUrl = new URL(`../../${hostNullCompleteStaticRepairHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const hostNullCompleteStaticRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: hostNullCompleteStaticRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => hostNullCompleteStaticRepairImplementationPaths
	.includes(path) || hostNullCompleteStaticRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact verifier lint repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseHostNullCompleteStaticRepairUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
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
 * Remove only the authenticated verifier lint and live-pin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHostNullCompleteStaticRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !hostNullCompleteStaticRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHostNullCompleteStaticRepairUpdate(current, update);
	}
	return current;
};
