/**
 * Reverse the authenticated partition-aware structural-Subtype validator repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const structuralSubtypePartitionValidatorHistoryPath
	= "docs/evidence/structural-subtype-partition-validator-source-history-20261021.json";
export const structuralSubtypePartitionValidatorPredecessor
	= "0bcbfabc708b746de492d55409ce1845c081e24b";
export const structuralSubtypePartitionValidatorImplementation
	= "be5ec0b8392124da608b35cffae8b76570a9edb7";
export const structuralSubtypePartitionValidatorChangedPaths = Object.freeze([
	"tests/helpers/structural-subtype-ci-workflow-tests.mjs"
	, "tests/helpers/structural-subtype-ci-workflow.mjs"
]);
export const structuralSubtypePartitionValidatorIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	structuralSubtypePartitionValidatorHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseStructuralSubtypePartitionValidatorUpdate = (
	source, update
) => {
	assert.ok([...structuralSubtypePartitionValidatorChangedPaths
		, ...structuralSubtypePartitionValidatorIntegrationPaths]
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
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
 * Remove only this exact validator repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeStructuralSubtypePartitionValidatorSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...structuralSubtypePartitionValidatorChangedPaths
			, ...structuralSubtypePartitionValidatorIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseStructuralSubtypePartitionValidatorUpdate(source, update)
		: source;
};
