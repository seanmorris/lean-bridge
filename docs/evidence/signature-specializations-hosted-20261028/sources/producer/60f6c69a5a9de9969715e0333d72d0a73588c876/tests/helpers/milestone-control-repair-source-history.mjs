/**
 * Authenticate the Perl contract history gap, valid reviewed Fin mismatch
 * controls and milestone-specific JVM documentation checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const milestoneControlRepairHistoryPath
	= "docs/evidence/milestone-control-repair-source-history-20261024.json";
export const milestoneControlRepairPredecessor
	= "ffb893c7e1ab6e1b90f5c8aab323c58947dd985c";
export const milestoneControlRepairImplementation
	= "b5fdb4a3a04b9e20dd4a413284199139a830d207";
export const milestoneControlRepairIntegrationBase
	= "b5fdb4a3a04b9e20dd4a413284199139a830d207";
export const milestoneControlRepairCommits = Object.freeze([
	"016f031cf5a178423f522688c4495aafe7b567c6"
	, "b5fdb4a3a04b9e20dd4a413284199139a830d207"
]);
export const milestoneControlRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/nested-checked-record-jvm-promotion-tests.mjs"
	, "tests/helpers/reviewed-fin-tests.mjs"
]);
export const milestoneControlRepairImplementationAddedPaths = Object.freeze([
	"docs/evidence/perl-callback-contract-gap-source-history-20261024.json"
	, "scripts/update-perl-callback-contract-gap-source-history.mjs"
	, "tests/helpers/perl-callback-contract-gap-source-history-tests.mjs"
	, "tests/helpers/perl-callback-contract-gap-source-history.mjs"
]);
export const milestoneControlRepairImplementationPaths = Object.freeze([
	...milestoneControlRepairChangedPaths
	, ...milestoneControlRepairImplementationAddedPaths
]);
export const milestoneControlRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const milestoneControlRepairNormalizationPaths = Object.freeze([
	...milestoneControlRepairChangedPaths
	, ...milestoneControlRepairIntegrationPaths
]);
export const milestoneControlRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-milestone-control-repair-source-history.mjs"
	, "tests/helpers/milestone-control-repair-source-history-tests.mjs"
	, "tests/helpers/milestone-control-repair-source-history.mjs"
]);
export const milestoneControlRepairAddedPaths = Object.freeze([
	...milestoneControlRepairImplementationAddedPaths
	, ...milestoneControlRepairHistoryAddedPaths
]);
export const milestoneControlRepairPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/reviewed-fin-tests.mjs"
		, count: 2
		, previousSha256: "2462c63780a61515874e9efa051e8ce358fc68b4d35d6544e70fdee6f2d67f92"
		, currentSha256: "ad91fbd4f78c50fcec012f5458cd38d5392ab131cd2658c1ac6994b62d710e04"
	})
	, Object.freeze({
		path: "tests/helpers/nested-checked-record-jvm-promotion-tests.mjs"
		, count: 4
		, previousSha256: "67576791547b299f1c45138a49c581668e3ca27d2342b0400e3eb8aceeb89dae"
		, currentSha256: "4ea7ce2521340273f1bf6a2cce9ecde54d24e3010f6346ab61dadeb9d39eabb9"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	milestoneControlRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseMilestoneControlRepairUpdate = (
	source, update
) => {
	assert.ok(milestoneControlRepairNormalizationPaths
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
 * Remove only the exact Milestone control repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeMilestoneControlRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !milestoneControlRepairNormalizationPaths.includes(path))
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
		current = reverseMilestoneControlRepairUpdate(current, update);
	}
	return current;
};
