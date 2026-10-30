/**
 * Preserve the exact NativeExports live-pin repair exposed by final Core.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreNativeExportsPinRepairHistoryPath
	= "docs/evidence/core-native-exports-pin-repair-source-history-20261030.json";
export const coreNativeExportsPinRepairPredecessor
	= "39c8e1d5a362565f8f2daf8f0a7bf547fe1da9b3";
export const coreNativeExportsPinRepairImplementation
	= "53e6784be2fbc92df395d7b1502adc76de9c3ceb";
export const coreNativeExportsPinRepairSourcePath
	= "src/analyze/NativeExports.lean";
export const coreNativeExportsPinRepairPreviousDigest
	= "82c3223591db88dc106e5899ca502d562e79ae5f48499921d409ef8b484fead2";
export const coreNativeExportsPinRepairCurrentDigest
	= "16f052dbe8d1b6491205621bc5062d67e1bdb64694672e703840c53bd8171954";
export const coreNativeExportsPinRepairRefreshedPins = 155;
export const coreNativeExportsPinRepairImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const coreNativeExportsPinRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreNativeExportsPinRepairHistoryAdditions = Object.freeze([
	"scripts/update-core-native-exports-pin-repair-source-history.mjs"
	, "tests/helpers/core-native-exports-pin-repair-source-history-tests.mjs"
	, "tests/helpers/core-native-exports-pin-repair-source-history.mjs"
]);

const historyUrl = new URL(`../../${coreNativeExportsPinRepairHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreNativeExportsPinRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: coreNativeExportsPinRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => coreNativeExportsPinRepairImplementationPaths
	.includes(path) || coreNativeExportsPinRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact NativeExports pin transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseCoreNativeExportsPinRepairUpdate = (source, update) => {
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
 * Remove only the authenticated NativeExports pin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreNativeExportsPinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreNativeExportsPinRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreNativeExportsPinRepairUpdate(current, update);
	}
	return current;
};
