/**
 * Preserve the downstream direct-proof control repairs and source-pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const downstreamDirectProofControlRepairHistoryPath
	= "docs/evidence/downstream-direct-proof-control-repair-source-history-20261028.json";
export const downstreamDirectProofControlRepairPredecessor
	= "39c9940d3a0b9b665627df9684dc203ddffd569e";
export const downstreamDirectProofControlRepairImplementation
	= "fe8bc7b85cbdccf76ba456894272b0eb217a02f7";
export const downstreamDirectProofControlRepairCommits = Object.freeze([
	"09769597a1ba4c1c2623b0fffacba0d0919fe301"
	, downstreamDirectProofControlRepairImplementation
]);
export const downstreamDirectProofControlRepairImplementationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/documentation.test.mjs"
		, "tests/helpers/managed-ci-isolation.mjs"
		, "tests/helpers/native-ci-isolation.mjs"
		, "tests/helpers/native-observation-split-tests.mjs"
		, "tests/helpers/nominal-subtype-jvm-ci-workflow.mjs"
		, "tests/helpers/nominal-subtype-wit-ci-workflow.mjs"
		, "tests/helpers/owned-borrow-evidence.mjs"
		, "tests/helpers/reviewed-subtype-host-fixture.mjs"
		, "tests/helpers/reviewed-subtype-host-report.mjs"
		, "tests/helpers/structural-subtype-ci-workflow-tests.mjs"
		, "tests/helpers/structural-subtype-ci-workflow.mjs"
		, "tests/managed-ci-isolation.test.mjs"
		, "tests/perl-contract.test.mjs"
	]);
export const downstreamDirectProofControlRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const downstreamDirectProofControlRepairNormalizationPaths
	= Object.freeze([
		...downstreamDirectProofControlRepairImplementationPaths
		, ...downstreamDirectProofControlRepairIntegrationPaths
	]);
export const downstreamDirectProofControlRepairAddedPaths
	= Object.freeze([
		"scripts/update-downstream-direct-proof-control-repair-source-history.mjs"
		, "tests/helpers/downstream-direct-proof-control-repair-source-history-tests.mjs"
		, "tests/helpers/downstream-direct-proof-control-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	downstreamDirectProofControlRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated control-repair transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and current-side edits.
 */
export const reverseDownstreamDirectProofControlRepairUpdate
	= (source, update) => {
		assert.ok(downstreamDirectProofControlRepairNormalizationPaths
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
 * Remove only this repair and its newest-first central registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDownstreamDirectProofControlRepairSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !downstreamDirectProofControlRepairNormalizationPaths
				.includes(path)) return source;
		const value = record();
		const updates = [...value.integrationUpdates, ...value.updates];
		let current = source;
		for(let count = 0; count < updates.length; ++count)
		{
			const digest = sha256(current);
			if(digest === expected) return current;
			const update = updates.find(item =>
				item.path === path && item.currentSha256 === digest);
			if(update === undefined) return current;
			current = reverseDownstreamDirectProofControlRepairUpdate(
				current, update);
		}
		return current;
	};
