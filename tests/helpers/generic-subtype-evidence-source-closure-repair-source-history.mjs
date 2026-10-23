/**
 * Reverse the exact generic-Subtype hosted source-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeEvidenceSourceClosureRepairHistoryPath
	= "docs/evidence/generic-subtype-evidence-source-closure-repair-source-history-20261023.json";
export const genericSubtypeEvidenceSourceClosureRepairPredecessor
	= "55eeb3ff80bb672a7590db30c0b4d98f26514082";
export const genericSubtypeEvidenceSourceClosureRepairImplementation
	= "3a1ba367c26d935b400bfe33fe50d2df566a3bb5";
export const genericSubtypeEvidenceSourceClosureRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/generic-subtype-hosted-contract-tests.mjs"
		, "tests/helpers/generic-subtype-hosted-evidence-sources.mjs"
	]);
export const genericSubtypeEvidenceSourceClosureRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const genericSubtypeEvidenceSourceClosureRepairChangedPaths
	= Object.freeze([
		...genericSubtypeEvidenceSourceClosureRepairImplementationPaths
		, ...genericSubtypeEvidenceSourceClosureRepairIntegrationPaths
	]);
export const genericSubtypeEvidenceSourceClosureRepairAddedPaths
	= Object.freeze([
		"scripts/update-generic-subtype-evidence-source-closure-repair-source-history.mjs"
		, "tests/helpers/generic-subtype-evidence-source-closure-repair-source-history-tests.mjs"
		, "tests/helpers/generic-subtype-evidence-source-closure-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeEvidenceSourceClosureRepairHistoryPath, "utf8"));

/**
 * Restore one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded source transition.
 */
export const reverseGenericSubtypeEvidenceSourceClosureRepairUpdate = (
	source, update
) => {
	assert.ok(genericSubtypeEvidenceSourceClosureRepairChangedPaths.includes(
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
 * Remove only the generic-Subtype evidence source-closure repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeGenericSubtypeEvidenceSourceClosureRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !genericSubtypeEvidenceSourceClosureRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseGenericSubtypeEvidenceSourceClosureRepairUpdate(
			source, update);
};
