/**
 * Preserve the focused HostNull managed and systems producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullManagedSystemsRepairHistoryPath
	= "docs/evidence/host-null-managed-systems-repair-source-history-20261030.json";
export const hostNullManagedSystemsRepairPredecessor
	= "674150f63580fd35b60cae30d95be45db61599d7";
export const hostNullManagedSystemsRepairImplementation
	= "bb66a166b28db246276a0c535d7f69b7286725af";
export const hostNullManagedSystemsRepairImplementationPaths
	= Object.freeze([
		"scripts/run-host-null-systems-ci.sh"
		, "src/build/compile-jvm-sources.mjs"
		, "tests/dotnet-host-null-contract.test.mjs"
		, "tests/helpers/host-null-managed-installed.mjs"
		, "tests/jvm-kotlin-contract.test.mjs"
		, "tests/systems-host-null-ci.test.mjs"
	]);
export const hostNullManagedSystemsRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const hostNullManagedSystemsRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-host-null-managed-systems-repair-source-history.mjs"
		, "tests/helpers/host-null-managed-systems-repair-source-history-tests.mjs"
		, "tests/helpers/host-null-managed-systems-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${hostNullManagedSystemsRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const hostNullManagedSystemsRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: hostNullManagedSystemsRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	hostNullManagedSystemsRepairImplementationPaths.includes(path)
	|| hostNullManagedSystemsRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseHostNullManagedSystemsRepairUpdate = (source, update) => {
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
 * Remove only the authenticated focused HostNull producer repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHostNullManagedSystemsRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !hostNullManagedSystemsRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHostNullManagedSystemsRepairUpdate(current, update);
	}
	return current;
};
