/**
 * Preserve the managed diagnostics and WIT local-name repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureManagedWitRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-managed-wit-repair-source-history-20261030.json";
export const directProofErasureManagedWitRepairPredecessor
	= "f949ee06c47443b5213e67291b1faf00f832abb6";
export const directProofErasureManagedWitRepairImplementation
	= "8a56eb33c03e494cd626bf63f2f8e6946ed420cc";
export const directProofErasureManagedWitRepairImplementationPaths
	= Object.freeze([
		"src/backends/wit/copied-host.mjs"
		, "tests/direct-proof-erasure-managed-installed.test.mjs"
		, "tests/helpers/direct-proof-erasure-managed-report.mjs"
		, "tests/helpers/direct-proof-erasure-managed-tests.mjs"
		, "tests/helpers/direct-proof-erasure-wit-tests.mjs"
	]);
export const directProofErasureManagedWitRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureManagedWitRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-managed-wit-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-managed-wit-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-managed-wit-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${directProofErasureManagedWitRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const directProofErasureManagedWitRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureManagedWitRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	directProofErasureManagedWitRepairImplementationPaths.includes(path)
	|| directProofErasureManagedWitRepairIntegrationPaths.includes(path);

/**
 * Reverse one authenticated managed/WIT repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseDirectProofErasureManagedWitRepairUpdate
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
 * Remove only the authenticated managed/WIT repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureManagedWitRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureManagedWitRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureManagedWitRepairUpdate(
				current, update);
	}
	return current;
};
