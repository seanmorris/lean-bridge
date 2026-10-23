/**
 * Reverse the merge of callback checked-record support with the dependent
 * checked-record archive line while preserving both authenticated histories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackDependentIntegrationHistoryPath
	= "docs/evidence/callback-dependent-integration-source-history-20261022.json";
export const callbackDependentIntegrationCommit
	= "66dca3c0656e849b29f409c39b93507a79348789";
export const callbackDependentIntegrationLeftParent
	= "abb4bc181fe1a875efb93ea5563624dfa496df52";
export const callbackDependentIntegrationRightParent
	= "3acd57b990b9f883ead5c26d23a64c7ec89796e7";
export const callbackDependentIntegrationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/backends/javascript/generate.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackDependentIntegrationAddedPaths = Object.freeze([
	"scripts/update-callback-dependent-integration-source-history.mjs"
	, "tests/callback-dependent-integration-source-history.test.mjs"
	, "tests/helpers/callback-dependent-integration-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackDependentIntegrationHistoryPath, "utf8"
));

/**
 * Restore one exact parent of the reconciled merge source.
 *
 * @param source - Complete reconciled source.
 * @param update - Exact two-parent transition.
 * @param parent - Parent route to restore.
 */
export const reverseCallbackDependentIntegrationUpdate = (
	source, update, parent
) => {
	assert.ok(callbackDependentIntegrationChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(["left", "right"].includes(parent));
	const endpoint = update[parent];
	assert.deepEqual(Object.keys(endpoint).sort()
		, ["edits", "previousSha256"]);
	assert.ok(Array.isArray(endpoint.edits) && endpoint.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of endpoint.edits)
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
	assert.equal(sha256(previous), endpoint.previousSha256, update.path);
	return previous;
};

/**
 * Remove the merge reconciliation through the parent that owns the requested
 * historical digest. Digests shared before the fork use the first parent.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCallbackDependentIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackDependentIntegrationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	if(!update) return source;
	assert.ok(Array.isArray(update.rightExpectedSha256));
	const parent = update.rightExpectedSha256.includes(expected)
		? "right" : "left";
	return reverseCallbackDependentIntegrationUpdate(source, update, parent);
};
