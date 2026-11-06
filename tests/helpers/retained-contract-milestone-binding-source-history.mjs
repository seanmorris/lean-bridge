/**
 * Preserve retained-contract checks at their authenticated milestones.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const retainedContractMilestoneBindingHistoryPath
	= "docs/evidence/retained-contract-milestone-binding-source-history-20261106.json";
export const retainedContractMilestoneBindingPredecessor
	= "e1934930d2536739e6f6c3a6cb6eb7861570c3e3";
export const retainedContractMilestoneBindingImplementation
	= "efdee33564235f8770615518ec70cb07ca36f8b6";
export const retainedContractMilestoneBindingImplementationPaths
	= Object.freeze([
		"tests/helpers/fin-container-edge-measured-evidence-tests.mjs"
		, "tests/helpers/fin-container-edge-report.mjs"
		, "tests/helpers/owned-checked-record-hosted-evidence-sources.mjs"
		, "tests/helpers/owned-checked-record-npm-producer.mjs"
		, "tests/helpers/owned-subtype-hosted-evidence-sources.mjs"
		, "tests/helpers/reviewed-fin-tests.mjs"
		, "tests/helpers/reviewed-subtype-decisions-tests.mjs"
		, "tests/php-nix-boundary-repair-evidence.test.mjs"
		, "tests/reviewed-source.test.mjs"
		, "tests/rust-collection-evidence.test.mjs"
	]);
export const retainedContractMilestoneBindingIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const retainedContractMilestoneBindingHistoryAdditions
	= Object.freeze([
		"scripts/update-retained-contract-milestone-binding-source-history.mjs"
		, "tests/helpers/retained-contract-milestone-binding-source-history-tests.mjs"
		, "tests/helpers/retained-contract-milestone-binding-source-history.mjs"
	]);
export const retainedContractMilestoneBindingNormalizationPaths
	= Object.freeze([...new Set([
		...retainedContractMilestoneBindingImplementationPaths
		, ...retainedContractMilestoneBindingIntegrationPaths
	])].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	retainedContractMilestoneBindingHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseRetainedContractMilestoneBindingUpdate = (
	source, update
) => {
	assert.ok(retainedContractMilestoneBindingNormalizationPaths
		.includes(update.path), update.path);
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
 * Remove integration and implementation transitions in order.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeRetainedContractMilestoneBindingSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !retainedContractMilestoneBindingNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseRetainedContractMilestoneBindingUpdate(
				current, update);
	}
	return current;
};
