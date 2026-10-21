/**
 * Reverse the authenticated nominal Subtype entry-measurement source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypeEntryMeasurementHistoryPath
	= "docs/evidence/nominal-subtype-entry-measurement-source-history-20261020.json";
export const nominalSubtypeEntryMeasurementPredecessor
	= "b72154dd80bc6c86f9764c11f68505ed9b656039";
export const nominalSubtypeEntryMeasurementImplementation
	= "83f7142a5437b8b4477c85fc2f1e6411ccea2b21";
export const nominalSubtypeEntryMeasurementChangedPaths = [
	"tests/helpers/component-nominal-subtype-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-entry-npm.mjs"
];
let history;

/**
 * Restore one complete update after authenticating both endpoints and every edit.
 *
 * @param source - Current complete source text.
 * @param update - Recorded exact update.
 */
export const reverseNominalSubtypeEntryMeasurementUpdate = (source, update) => {
	assert.ok(nominalSubtypeEntryMeasurementChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Preserve unknown sources and stop at an explicitly requested digest.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeNominalSubtypeEntryMeasurementSource = (path, source, expected) => {
	if(typeof source !== "string" || !nominalSubtypeEntryMeasurementChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeEntryMeasurementHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeEntryMeasurementUpdate(source, update) : source;
};
