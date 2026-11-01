/**
 * Preserve the final exact-candidate live-source pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finalLiveSourcePinRepairHistoryPath
	= "docs/evidence/final-live-source-pin-repair-source-history-20261101.json";
export const finalLiveSourcePinRepairPredecessor
	= "faaaec994177fc65fd4d35e6b24b2e5a3bd415a8";
export const finalLiveSourcePinRepairImplementation
	= "91248d5abe96acab7cddd84f5579deb3a6778685";
export const finalLiveSourcePinRepairImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const finalLiveSourcePinRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const finalLiveSourcePinRepairHistoryAdditions = Object.freeze([
	"scripts/update-final-live-source-pin-repair-source-history.mjs"
	, "tests/helpers/final-live-source-pin-repair-source-history-tests.mjs"
	, "tests/helpers/final-live-source-pin-repair-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + finalLiveSourcePinRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const finalLiveSourcePinRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: finalLiveSourcePinRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => finalLiveSourcePinRepairImplementationPaths
	.includes(path) || finalLiveSourcePinRepairIntegrationPaths.includes(path);

/**
 * Reverse one authenticated final live-source pin transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseFinalLiveSourcePinRepairUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only the authenticated final live-source pin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeFinalLiveSourcePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !finalLiveSourcePinRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseFinalLiveSourcePinRepairUpdate(current, update);
	}
	return current;
};
