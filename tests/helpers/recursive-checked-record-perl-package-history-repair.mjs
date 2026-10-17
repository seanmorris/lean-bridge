/**
 * Authenticate the recursive checked-record Perl package transition omitted from
 * its later diagnostic source-history layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeMutualCheckedRecordJvmSource
} from "./mutual-checked-record-jvm-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const recursiveCheckedRecordPerlPackageHistoryRepairPath
	= "docs/evidence/recursive-checked-record-perl-package-history-repair-20261017.json";
export const recursiveCheckedRecordPerlPackageHistoryRepairPredecessor
	= "041c55a074e8357f118b3c260e0e99315b340433";
export const recursiveCheckedRecordPerlPackageHistoricalCommit
	= "6b5a9a9b96b4e688f15ec7f5629d3ab8213fabf9";
export const recursiveCheckedRecordPerlPackageHistoricalParent
	= "5af8ea24701671a08d3da001edac34ba9d49385a";
export const recursiveCheckedRecordPerlPackageHistoricalPaths = Object.freeze([
	"src/backends/perl/copied-graph-package.mjs"
	, "src/backends/perl/copied-graph-values.mjs"
	, "src/backends/perl/copied-graph-xs.mjs"
]);
export const recursiveCheckedRecordPerlPackageHistoryRepairChangedPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/recursive-checked-record-perl-diagnostic-source-history.mjs"
		, "tests/type-surface.test.mjs"
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	recursiveCheckedRecordPerlPackageHistoryRepairPath, "utf8"
));

/**
 * Reverse one exact transition after checking its complete source identity.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated source transition.
 * @param paths - Closed path set for the transition.
 */
const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
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
 * Reverse a source change made by the current history-repair layer.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated current repair transition.
 */
export const reverseRecursiveCheckedRecordPerlPackageHistoryRepairUpdate
	= (source, update) => reverse(source, update
		, recursiveCheckedRecordPerlPackageHistoryRepairChangedPaths);

/**
 * Reverse the exact historical package transition omitted at commit 6b5a9a9.
 *
 * @param source - Complete historical source text after the omitted change.
 * @param update - Authenticated omitted historical transition.
 */
export const reverseRecursiveCheckedRecordPerlPackageHistoricalUpdate
	= (source, update) => reverse(source, update
		, recursiveCheckedRecordPerlPackageHistoricalPaths);

/**
 * Remove only the current repair integration at its exact source identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutRecursiveCheckedRecordPerlPackageHistoryRepair = (
	path, source
) => {
	if(typeof source !== "string"
		|| !recursiveCheckedRecordPerlPackageHistoryRepairChangedPaths.includes(path))
		return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseRecursiveCheckedRecordPerlPackageHistoryRepairUpdate(
			source, update
		) : source;
};

/**
 * Reverse the current repair integration. The central history hub continues
 * through newer and older milestones after this function returns.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRecursiveCheckedRecordPerlPackageHistoryRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !recursiveCheckedRecordPerlPackageHistoryRepairChangedPaths.includes(path))
		return source;
	if(sha256(source) === expected) return source;
	return withoutRecursiveCheckedRecordPerlPackageHistoryRepair(path, source);
};

/**
 * Reverse the omitted Perl package transition, then continue through the older
 * checked-record history chain.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRecursiveCheckedRecordPerlPackageHistoricalSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !recursiveCheckedRecordPerlPackageHistoricalPaths.includes(path))
		return beforeMutualCheckedRecordJvmSource(path, source, expected);
	let digest = sha256(source);
	if(digest === expected) return source;
	const update = record().historicalUpdates.find(item => item.path === path);
	if(update?.currentSha256 === digest)
	{
		source = reverseRecursiveCheckedRecordPerlPackageHistoricalUpdate(
			source, update
		);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	return beforeMutualCheckedRecordJvmSource(path, source, expected);
};

/**
 * Restore current source pins for this repair layer.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeRecursiveCheckedRecordPerlPackageHistoryRepairPins
	= inventory => {
		const update = record().updates.find(item => item.path
			=== "docs/type-surface.v1.json");
		const current = JSON.stringify(inventory, null, 2) + "\n";
		return update?.currentSha256 === sha256(current)
			? JSON.parse(reverseRecursiveCheckedRecordPerlPackageHistoryRepairUpdate(
				current, update
			)) : structuredClone(inventory);
	};
