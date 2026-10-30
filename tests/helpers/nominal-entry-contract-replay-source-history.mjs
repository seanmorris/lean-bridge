/**
 * Preserve the nominal-entry historical-contract replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalEntryContractReplayHistoryPath
	= "docs/evidence/nominal-entry-contract-replay-source-history-20261030.json";
export const nominalEntryContractReplayPredecessor
	= "85fbdbbd1f362de8fe2f06d2fa19e9e845c19818";
export const nominalEntryContractReplayImplementation
	= "0bdda9fe2a0cc2af0114fac77fdf9621d1ef31fa";
export const nominalEntryContractReplayImplementationPaths = Object.freeze([
	"tests/helpers/nominal-subtype-entry-measurement-source-history-tests.mjs"
	, "tests/helpers/nominal-subtype-entry-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-entry-publication-source-history-tests.mjs"
]);
export const nominalEntryContractReplayIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const nominalEntryContractReplayHistoryAdditions = Object.freeze([
	"scripts/update-nominal-entry-contract-replay-source-history.mjs"
	, "tests/helpers/nominal-entry-contract-replay-source-history-tests.mjs"
	, "tests/helpers/nominal-entry-contract-replay-source-history.mjs"
]);

const historyUrl = new URL(`../../${nominalEntryContractReplayHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const nominalEntryContractReplayNormalizationPaths = Object.freeze([
	...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: nominalEntryContractReplayImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])
].sort());
const allowedPath = path => nominalEntryContractReplayImplementationPaths
	.includes(path) || nominalEntryContractReplayIntegrationPaths.includes(path);

/**
 * Reverse one exact historical-contract replay transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseNominalEntryContractReplayUpdate = (source, update) => {
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
 * Remove only the authenticated historical-contract replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeNominalEntryContractReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nominalEntryContractReplayNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseNominalEntryContractReplayUpdate(current, update);
	}
	return current;
};
