/**
 * Preserve the optional-parameter automatic-trigger policy repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterTriggerPolicyHistoryPath
	= "docs/evidence/optional-parameter-trigger-policy-source-history-20261030.json";
export const optionalParameterTriggerPolicyPredecessor
	= "47929f346549405507018f6311b8bef9aa6e7640";
export const optionalParameterTriggerPolicyImplementation
	= "808da43df689b7490e102f1560e93f2bb0826c7a";
export const optionalParameterTriggerPolicyImplementationPaths = Object.freeze([
	"tests/workflow-trigger-policy.test.mjs"
]);
export const optionalParameterTriggerPolicyIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const optionalParameterTriggerPolicyHistoryAdditions = Object.freeze([
	"scripts/update-optional-parameter-trigger-policy-source-history.mjs"
	, "tests/helpers/optional-parameter-trigger-policy-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-trigger-policy-source-history.mjs"
]);

const historyUrl = new URL(`../../${optionalParameterTriggerPolicyHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterTriggerPolicyNormalizationPaths = Object.freeze([
	...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: optionalParameterTriggerPolicyImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])
].sort());
const allowedPath = path => optionalParameterTriggerPolicyImplementationPaths
	.includes(path) || optionalParameterTriggerPolicyIntegrationPaths.includes(path);

/**
 * Reverse one exact trigger-policy transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseOptionalParameterTriggerPolicyUpdate = (source, update) => {
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
 * Remove only the authenticated optional-parameter policy repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOptionalParameterTriggerPolicySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterTriggerPolicyNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOptionalParameterTriggerPolicyUpdate(current, update);
	}
	return current;
};
