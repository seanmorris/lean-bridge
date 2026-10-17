/**
 * Preserve the reviewed recursive Perl diagnostic-name correction.
 *
 * The diagnostic implementation predates the evidence archive. Integration files
 * use the later archive commit as their predecessor, while the three corrected
 * sources retain the exact pre-correction commit.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeMutualCheckedRecordJvmPins, beforeMutualCheckedRecordJvmSource
} from "./mutual-checked-record-jvm-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const recursiveCheckedRecordPerlDiagnosticHistoryPath
	= "docs/evidence/recursive-checked-record-perl-diagnostic-source-history-20261017.json";
export const recursiveCheckedRecordPerlDiagnosticSourcePredecessor
	= "a85274a5393185569a968502b38d941584ff776c";
export const recursiveCheckedRecordPerlDiagnosticDraftParent
	= "e77239ad65a8cb7e1db1dfdd8a04174214ee404b";
export const recursiveCheckedRecordPerlDiagnosticSourcePaths = Object.freeze([
	"src/backends/c/native-graph-adapters.mjs"
	, "src/backends/perl/copied-graph-package.mjs"
	, "tests/recursive-checked-records.test.mjs"
]);
export const recursiveCheckedRecordPerlDiagnosticChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, ...recursiveCheckedRecordPerlDiagnosticSourcePaths
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/mutual-checked-record-jvm-source-history.test.mjs"
	, "tests/type-surface.test.mjs"
]);
export const recursiveCheckedRecordPerlDiagnosticEvidenceSourcePaths
	= Object.freeze([
		...recursiveCheckedRecordPerlDiagnosticChangedPaths.slice(1)
		, "src/backends/perl/copied-graph-values.mjs"
		, "src/backends/perl/copied-graph-xs.mjs"
	]);
let history;

/**
 * Reverse one complete transition after checking every byte and digest.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseRecursiveCheckedRecordPerlDiagnosticUpdate = (
	source, update
) => {
	assert.ok(recursiveCheckedRecordPerlDiagnosticChangedPaths.includes(
		update.path
	));
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
 * Remove only this correction at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutRecursiveCheckedRecordPerlDiagnostic = (path, source) => {
	if(typeof source !== "string"
		|| !recursiveCheckedRecordPerlDiagnosticChangedPaths.includes(path))
		return source;
	const record = history ??= JSON.parse(readFileSync(
		recursiveCheckedRecordPerlDiagnosticHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseRecursiveCheckedRecordPerlDiagnosticUpdate(source, update)
		: source;
};

/**
 * Reverse this correction, then continue through older authenticated layers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRecursiveCheckedRecordPerlDiagnosticSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !recursiveCheckedRecordPerlDiagnosticChangedPaths.includes(path))
		return beforeMutualCheckedRecordJvmSource(path, source, expected);
	let digest = sha256(source);
	if(digest === expected) return source;
	const previous = withoutRecursiveCheckedRecordPerlDiagnostic(path, source);
	if(previous !== source)
	{
		source = previous;
		digest = sha256(source);
		if(digest === expected) return source;
	}
	return beforeMutualCheckedRecordJvmSource(path, source, expected);
};

/**
 * Restore this transition's pins, then every preceding history layer.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeRecursiveCheckedRecordPerlDiagnosticPins = inventory => {
	const record = history ??= JSON.parse(readFileSync(
		recursiveCheckedRecordPerlDiagnosticHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path
		=== "docs/type-surface.v1.json");
	const current = JSON.stringify(inventory, null, 2) + "\n";
	const previous = update?.currentSha256 === sha256(current)
		? JSON.parse(reverseRecursiveCheckedRecordPerlDiagnosticUpdate(
			current, update
		)) : structuredClone(inventory);
	return beforeMutualCheckedRecordJvmPins(previous);
};
