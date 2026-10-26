/**
 * Reverse the native nominal entry-probe variant-tag repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalEntryTagRepairHistoryPath
	= "docs/evidence/nominal-entry-tag-repair-source-history-20261023.json";
export const nominalEntryTagRepairPredecessor
	= "59fca2ffcb2222b88f9760502d75103c03b5dd5c";
export const nominalEntryTagRepairImplementation
	= "07587f92b0c1c6289b41c6b05f2debbc699bb20b";
export const nominalEntryTagRepairChangedPaths = Object.freeze([
	"tests/helpers/nominal-subtype-dispatch-tests.mjs"
	, "tests/helpers/nominal-subtype-dispatch.mjs"
]);
export const nominalEntryTagRepairIntegrationPaths = Object.freeze([
	"tests/helpers/component-nominal-subtype-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const nominalEntryTagRepairNormalizationPaths = Object.freeze([
	...nominalEntryTagRepairChangedPaths
	, ...nominalEntryTagRepairIntegrationPaths
]);
export const nominalEntryTagRepairAddedPaths = Object.freeze([
	"scripts/update-nominal-entry-tag-repair-source-history.mjs"
	, "tests/helpers/nominal-entry-tag-repair-source-history-tests.mjs"
	, "tests/helpers/nominal-entry-tag-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nominalEntryTagRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNominalEntryTagRepairUpdate = (source, update) => {
	assert.ok(nominalEntryTagRepairNormalizationPaths.includes(update.path));
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
 * Remove only the exact native nominal entry-probe variant-tag repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeNominalEntryTagRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nominalEntryTagRepairNormalizationPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update ? reverseNominalEntryTagRepairUpdate(source, update) : source;
};
