/**
 * Preserve the live evidence-pin repair that followed Core historical reuse.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHistoricalEvidenceReuseLivePinRepairHistoryPath
	= "docs/evidence/core-historical-evidence-reuse-live-pin-repair-source-history-20261027.json";
export const coreHistoricalEvidenceReuseLivePinRepairPredecessor
	= "67e691b8fc0938654d314bc7191497cdc2549802";
export const coreHistoricalEvidenceReuseLivePinRepairImplementation
	= "4b1f098cae4753fd0160fede38cb7233868c2ce9";
export const coreHistoricalEvidenceReuseLivePinRepairImplementationPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const coreHistoricalEvidenceReuseLivePinRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreHistoricalEvidenceReuseLivePinRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-core-historical-evidence-reuse-live-pin-repair-source-history.mjs"
		, "tests/helpers/core-historical-evidence-reuse-live-pin-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${coreHistoricalEvidenceReuseLivePinRepairHistoryPath}`
		, import.meta.url), "utf8"
));

/** List every source whose bytes participate in this transition. */
export const coreHistoricalEvidenceReuseLivePinRepairNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	coreHistoricalEvidenceReuseLivePinRepairImplementationPaths.includes(path)
	|| coreHistoricalEvidenceReuseLivePinRepairIntegrationPaths.includes(path);

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreHistoricalEvidenceReuseLivePinRepairUpdate = (
	source, update
) => {
	assert.ok(allowedTransitionPath(update.path), update.path);
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
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
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
 * Remove only the authenticated live-pin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreHistoricalEvidenceReuseLivePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	if(!updates.some(update => update.path === path)) return source;
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreHistoricalEvidenceReuseLivePinRepairUpdate(
			current, update);
	}
	return current;
};
