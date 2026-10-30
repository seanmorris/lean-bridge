/**
 * Preserve the systems HostNull route-versus-semantic identity repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullSystemsSemanticIdentityRepairHistoryPath
	= "docs/evidence/host-null-systems-semantic-identity-repair-source-history-20261030.json";
export const hostNullSystemsSemanticIdentityRepairPredecessor
	= "4c53b15a1269685bbf550136775b17e9068f5651";
export const hostNullSystemsSemanticIdentityRepairImplementation
	= "08d015ac9ddf8be038fed9618cd608e0cf1d0602";
export const hostNullSystemsSemanticIdentityRepairImplementationPaths = Object.freeze([
	"scripts/check-host-null-systems-ci.mjs"
	, "tests/helpers/host-null-systems-installed.mjs"
	, "tests/systems-host-null-ci.test.mjs"
]);
export const hostNullSystemsSemanticIdentityRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullSystemsSemanticIdentityRepairHistoryAdditions = Object.freeze([
	"scripts/update-host-null-systems-semantic-identity-repair-source-history.mjs"
	, "tests/helpers/host-null-systems-semantic-identity-repair-source-history-tests.mjs"
	, "tests/helpers/host-null-systems-semantic-identity-repair-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${hostNullSystemsSemanticIdentityRepairHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const hostNullSystemsSemanticIdentityRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: hostNullSystemsSemanticIdentityRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => hostNullSystemsSemanticIdentityRepairImplementationPaths
	.includes(path) || hostNullSystemsSemanticIdentityRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact systems identity repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseHostNullSystemsSemanticIdentityRepairUpdate = (source, update) => {
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
 * Remove only the authenticated systems semantic-identity repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHostNullSystemsSemanticIdentityRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !hostNullSystemsSemanticIdentityRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHostNullSystemsSemanticIdentityRepairUpdate(current, update);
	}
	return current;
};
