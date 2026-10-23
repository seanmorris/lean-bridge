/**
 * Reverse the authenticated nominal entry-measurement identity and probe-order repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalEntryRepairHistoryPath
	= "docs/evidence/nominal-entry-repair-source-history-20261022.json";
export const nominalEntryRepairPredecessor
	= "bc90cdc1c2a2c36b4099df2d2d6347201c02e1a4";
export const nominalEntryRepairImplementation
	= "f533a697bebc703b43b62be8650ccf8cdd1a3488";
export const nominalEntryRepairIntegrationPaths = Object.freeze([
	"tests/helpers/component-nominal-subtype-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const nominalEntryRepairImplementationPaths = Object.freeze([
	"tests/helpers/nominal-subtype-dispatch-tests.mjs"
	, "tests/helpers/nominal-subtype-dispatch.mjs"
	, "tests/helpers/nominal-subtype-entry-tests.mjs"
	, "tests/helpers/nominal-subtype-entry.mjs"
]);
export const nominalEntryRepairChangedPaths = Object.freeze([
	...nominalEntryRepairImplementationPaths
	, ...nominalEntryRepairIntegrationPaths
]);
export const nominalEntryRepairAddedPaths = Object.freeze([
	"scripts/update-nominal-entry-repair-source-history.mjs"
	, "tests/helpers/nominal-entry-repair-source-history-tests.mjs"
	, "tests/helpers/nominal-entry-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nominalEntryRepairHistoryPath, "utf8"));

/**
 * Restore one exact source transition after authenticating its endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNominalEntryRepairUpdate = (source, update) => {
	assert.ok(nominalEntryRepairChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this exact nominal entry-measurement repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeNominalEntryRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nominalEntryRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update ? reverseNominalEntryRepairUpdate(source, update) : source;
};
