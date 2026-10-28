/**
 * Authenticate the WIT producer disk repair without inferring installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedWitBootstrapHistoryPath
	= "docs/evidence/owned-checked-wit-bootstrap-source-history-20261025.json";
export const ownedCheckedWitBootstrapPredecessor
	= "e3b041b916a4c5818ab6404617fe7c5c1458217f";
export const ownedCheckedWitBootstrapImplementation
	= "511133455a579d2ccb137bc0babb0c8a3e8082de";
export const ownedCheckedWitBootstrapIntegrationBase
	= "511133455a579d2ccb137bc0babb0c8a3e8082de";
export const ownedCheckedWitBootstrapCommits = Object.freeze([
	"511133455a579d2ccb137bc0babb0c8a3e8082de"
]);
export const ownedCheckedWitBootstrapChangedPaths = Object.freeze([
	".github/workflows/owned-checked-record-managed.yml"
	, "tests/owned-checked-record-managed-packaging.test.mjs"
]);
export const ownedCheckedWitBootstrapImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-wit-bootstrap-20261025.json"
	, "docs/evidence/owned-wit-bootstrap-failure-20261025/artifact.json"
	, "docs/evidence/owned-wit-bootstrap-failure-20261025/artifact.zip"
	, "docs/evidence/owned-wit-bootstrap-failure-20261025/job.json"
	, "docs/evidence/owned-wit-bootstrap-failure-20261025/job.log"
	, "docs/evidence/owned-wit-bootstrap-failure-20261025/run.json"
	, "tests/helpers/wasmtime-capi-bootstrap.mjs"
]);
export const ownedCheckedWitBootstrapImplementationPaths = Object.freeze([
	...ownedCheckedWitBootstrapChangedPaths
	, ...ownedCheckedWitBootstrapImplementationAddedPaths
]);
export const ownedCheckedWitBootstrapIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedWitBootstrapNormalizationPaths = Object.freeze([
	...ownedCheckedWitBootstrapChangedPaths
	, ...ownedCheckedWitBootstrapIntegrationPaths
]);
export const ownedCheckedWitBootstrapHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-wit-bootstrap-source-history.mjs"
	, "tests/helpers/owned-checked-wit-bootstrap-source-history-tests.mjs"
	, "tests/helpers/owned-checked-wit-bootstrap-source-history.mjs"
]);
export const ownedCheckedWitBootstrapAddedPaths = Object.freeze([
	...ownedCheckedWitBootstrapImplementationAddedPaths
	, ...ownedCheckedWitBootstrapHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedWitBootstrapHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedWitBootstrapUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedWitBootstrapNormalizationPaths
		.includes(update.path));
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
 * Remove only the exact Owned checked WIT bootstrap.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedWitBootstrapSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedWitBootstrapNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedCheckedWitBootstrapUpdate(current, update);
	}
	return current;
};
