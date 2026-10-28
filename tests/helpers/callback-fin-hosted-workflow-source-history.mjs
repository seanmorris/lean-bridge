/**
 * Authenticate the callback Fin hosted-workflow integration without rewriting
 * the original callback checked-record workflow histories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinHostedWorkflowHistoryPath
	= "docs/evidence/callback-fin-hosted-workflow-source-history-20261028.json";
export const callbackFinHostedWorkflowPredecessor
	= "540ee7857c5afaf8095a1f2677fec366dbd6c04d";
export const callbackFinHostedWorkflowImplementation
	= "6a36ac9fa1506c9e6e6d245dc79d392d93ca1c3b";
export const callbackFinHostedWorkflowChangedPaths = Object.freeze([
	".github/workflows/callback-checked-record-languages.yml"
	, ".github/workflows/callback-checked-record-perl.yml"
	, ".github/workflows/callback-checked-record-remaining.yml"
]);
export const callbackFinHostedWorkflowRemovedPaths = Object.freeze([
	".github/workflows/callback-fin-languages.yml"
	, ".github/workflows/callback-fin-perl.yml"
	, ".github/workflows/callback-fin-remaining.yml"
]);
export const callbackFinHostedWorkflowImplementationPaths = Object.freeze([
	...callbackFinHostedWorkflowChangedPaths
	, ...callbackFinHostedWorkflowRemovedPaths
].toSorted());
export const callbackFinHostedWorkflowIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-07.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackFinHostedWorkflowNormalizationPaths = Object.freeze([
	...callbackFinHostedWorkflowChangedPaths
	, ...callbackFinHostedWorkflowIntegrationPaths
].toSorted());
export const callbackFinHostedWorkflowAddedPaths = Object.freeze([
	"scripts/update-callback-fin-hosted-workflow-source-history.mjs"
	, "tests/helpers/callback-fin-hosted-workflow-source-history-tests.mjs"
	, "tests/helpers/callback-fin-hosted-workflow-source-history.mjs"
]);
export const callbackFinHostedWorkflowPins = Object.freeze([
	Object.freeze({
		path: ".github/workflows/callback-checked-record-languages.yml"
		, count: 1
		, previousSha256: "6e8b65d3a95a5beea694e93113a4d80e52a014603d217dc19857629b160eeb87"
		, currentSha256: "dce35842eb034d7c54e37df9398f7b03252047d36071c80ebe4e29b738b24130"
	})
	, Object.freeze({
		path: ".github/workflows/callback-checked-record-remaining.yml"
		, count: 1
		, previousSha256: "7d18c69f92d00fe07c569e6510d902af5223d55131a1522ccd7a8fc8d1fcf554"
		, currentSha256: "e8a1c9db11008ba4e187576855b0517886512b5645f641b944a0c2410c103506"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinHostedWorkflowHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackFinHostedWorkflowUpdate = (source, update) => {
	assert.ok(callbackFinHostedWorkflowNormalizationPaths.includes(update.path));
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
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact hosted callback Fin workflow transition. Without an
 * explicit stop, unwind the integration and then the implementation change.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCallbackFinHostedWorkflowSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackFinHostedWorkflowNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCallbackFinHostedWorkflowUpdate(current, update);
	}
	return current;
};
