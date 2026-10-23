/**
 * Reverse the exact generic-Subtype hosted artifact-prefix repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeArtifactPrefixRepairHistoryPath
	= "docs/evidence/generic-subtype-artifact-prefix-repair-source-history-20261023.json";
export const genericSubtypeArtifactPrefixRepairPredecessor
	= "9842c9c1a580a20e7e95f9916bee870a07cd88e7";
export const genericSubtypeArtifactPrefixRepairImplementation
	= "de3f6cba17e03030472569edca1d79b3c577209f";
export const genericSubtypeArtifactPrefixRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/generic-subtype-hosted-contract-tests.mjs"
		, "tests/helpers/generic-subtype-hosted-contracts.mjs"
	]);
export const genericSubtypeArtifactPrefixRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const genericSubtypeArtifactPrefixRepairChangedPaths = Object.freeze([
	...genericSubtypeArtifactPrefixRepairImplementationPaths
	, ...genericSubtypeArtifactPrefixRepairIntegrationPaths
]);
export const genericSubtypeArtifactPrefixRepairAddedPaths = Object.freeze([
	"scripts/update-generic-subtype-artifact-prefix-repair-source-history.mjs"
	, "tests/helpers/generic-subtype-artifact-prefix-repair-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-artifact-prefix-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeArtifactPrefixRepairHistoryPath, "utf8"));

/**
 * Restore one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded source transition.
 */
export const reverseGenericSubtypeArtifactPrefixRepairUpdate = (
	source, update
) => {
	assert.ok(genericSubtypeArtifactPrefixRepairChangedPaths.includes(
		update.path));
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
 * Remove only the generic-Subtype hosted artifact-prefix repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeGenericSubtypeArtifactPrefixRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !genericSubtypeArtifactPrefixRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseGenericSubtypeArtifactPrefixRepairUpdate(source, update);
};
