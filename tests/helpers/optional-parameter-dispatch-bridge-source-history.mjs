/**
 * Preserve the registered dispatch bridge for focused optional-parameter CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterDispatchBridgeHistoryPath
	= "docs/evidence/optional-parameter-dispatch-bridge-source-history-20261029.json";
export const optionalParameterDispatchBridgePredecessor
	= "06a6b53ab1669724500896e23df2c6a963d76261";
export const optionalParameterDispatchBridgeImplementation
	= "508900c0b79d586c4a364efe9020a51704ff7cde";
export const optionalParameterDispatchBridgeImplementationPaths = Object.freeze([
	".github/workflows/dependent-checked-record-matrix.yml"
	, ".github/workflows/optional-parameter-complete.yml"
	, "tests/helpers/dependent-checked-record-matrix-ci-tests.mjs"
	, "tests/helpers/optional-parameter-matrix-receipt-tests.mjs"
]);
export const optionalParameterDispatchBridgeIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-focused-ci-source-history-tests.mjs"
]);
export const optionalParameterDispatchBridgeHistoryAdditions = Object.freeze([
	"scripts/update-optional-parameter-dispatch-bridge-source-history.mjs"
	, "tests/helpers/optional-parameter-dispatch-bridge-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-dispatch-bridge-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${optionalParameterDispatchBridgeHistoryPath}`
		, import.meta.url), "utf8"
));
export const optionalParameterDispatchBridgeNormalizationPaths = Object.freeze([
	...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])
].sort());
const allowedPath = path => optionalParameterDispatchBridgeImplementationPaths
	.includes(path) || optionalParameterDispatchBridgeIntegrationPaths
	.includes(path);

/**
 * Reverse one exact dispatch-bridge source transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterDispatchBridgeUpdate = (source, update) => {
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
 * Remove dispatch registration and implementation transitions newest-first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalParameterDispatchBridgeSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterDispatchBridgeNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected)
			return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOptionalParameterDispatchBridgeUpdate(current, update);
	}
	return current;
};
