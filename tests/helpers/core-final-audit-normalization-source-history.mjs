/**
 * Preserve reversible normalization for every final-audit source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreFinalAuditNormalizationHistoryPath
	= "docs/evidence/core-final-audit-normalization-source-history-20261031.json";
export const coreFinalAuditNormalizationBaseline
	= "52ab956e51c9584bc3cfc01d7b9bd2b0fb88aa43";
export const coreFinalAuditNormalizationIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreFinalAuditNormalizationHistoryAdditions = Object.freeze([
	"scripts/update-core-final-audit-normalization-source-history.mjs"
	, "tests/helpers/core-final-audit-normalization-source-history-tests.mjs"
	, "tests/helpers/core-final-audit-normalization-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + coreFinalAuditNormalizationHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
const historicalPaths = () => existsSync(historyUrl)
	? record().milestones.flatMap(milestone =>
		milestone.updates.map(update => update.path))
	: [];
export const coreFinalAuditNormalizationPaths = Object.freeze([...new Set([
	...historicalPaths(), ...coreFinalAuditNormalizationIntegrationPaths
])].sort());
const allowedPath = path => coreFinalAuditNormalizationPaths.includes(path);

/**
 * Reverse one exact final-audit transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseCoreFinalAuditNormalizationUpdate = (source, update) => {
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
 * Remove authenticated final-audit transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreFinalAuditNormalizationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreFinalAuditNormalizationPaths.includes(path))
		return source;
	let current = source;
	const streams = [
		record().integrationUpdates
		, ...record().milestones.toReversed().map(milestone => milestone.updates)
	];
	for(const updates of streams)
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreFinalAuditNormalizationUpdate(current, update);
	}
	return current;
};
