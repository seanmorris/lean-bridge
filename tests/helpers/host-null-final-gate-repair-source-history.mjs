/**
 * Preserve the final focused HostNull managed and systems gate repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullFinalGateRepairHistoryPath
	= "docs/evidence/host-null-final-gate-repair-source-history-20261030.json";
export const hostNullFinalGateRepairPredecessor
	= "2abf71eee32722c5bbc5b48701b61d77995e541a";
export const hostNullFinalGateRepairImplementation
	= "b90de0f8f5d4286bda008d44d04e4f97e87e0785";
export const hostNullFinalGateRepairImplementationPaths = Object.freeze([
	"scripts/check-host-null-managed-ci.mjs"
	, "tests/dotnet-host-null-contract.test.mjs"
	, "tests/helpers/host-null-systems-installed.mjs"
	, "tests/systems-host-null-ci.test.mjs"
	, "tests/systems-host-null-contract.test.mjs"
]);
export const hostNullFinalGateRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullFinalGateRepairHistoryAdditions = Object.freeze([
	"scripts/update-host-null-final-gate-repair-source-history.mjs"
	, "tests/helpers/host-null-final-gate-repair-source-history-tests.mjs"
	, "tests/helpers/host-null-final-gate-repair-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${hostNullFinalGateRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const hostNullFinalGateRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: hostNullFinalGateRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => hostNullFinalGateRepairImplementationPaths
	.includes(path) || hostNullFinalGateRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact gate-repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseHostNullFinalGateRepairUpdate = (source, update) => {
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
 * Remove only the authenticated final HostNull gate repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHostNullFinalGateRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !hostNullFinalGateRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHostNullFinalGateRepairUpdate(current, update);
	}
	return current;
};
