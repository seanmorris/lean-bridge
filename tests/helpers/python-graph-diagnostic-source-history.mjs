/**
 * Authenticate exact checked-refinement diagnostics in recursive Python graph wheels.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeMutualCheckedRecordNpmPins
	, beforeMutualCheckedRecordNpmSource
} from "./mutual-checked-record-npm-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const pythonGraphDiagnosticHistoryPath
	= "docs/evidence/python-graph-diagnostic-source-history-20261016.json";
export const pythonGraphDiagnosticPredecessor
	= "ccfe595978b6c984bb25c1948ac516aff2c750fe";
export const pythonGraphDiagnosticDraftParent
	= "ccfe595978b6c984bb25c1948ac516aff2c750fe";
export const pythonGraphDiagnosticChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/backends/python/copied-graph-conversions.mjs"
	, "src/backends/python/copied-graph-package.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-graph-sources.mjs"
	, "src/release/native-pypi.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/mutual-checked-record-npm-source-history-tests.mjs"
	, "tests/helpers/mutual-checked-record-source-history-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reversePythonGraphDiagnosticUpdate = (source, update) => {
	assert.ok(pythonGraphDiagnosticChangedPaths.includes(update.path));
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
 * Remove only this Python graph diagnostic transition at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutPythonGraphDiagnostic = (path, source) => {
	if(typeof source !== "string"
		|| !pythonGraphDiagnosticChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		pythonGraphDiagnosticHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reversePythonGraphDiagnosticUpdate(source, update) : source;
};

/**
 * Reverse this transition, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePythonGraphDiagnosticSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !pythonGraphDiagnosticChangedPaths.includes(path))
		return beforeMutualCheckedRecordNpmSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutPythonGraphDiagnostic(path, source);
	if(previous !== source) return previous;
	return beforeMutualCheckedRecordNpmSource(path, source, expected);
};

/**
 * Restore source pins through this transition and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforePythonGraphDiagnosticPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		pythonGraphDiagnosticHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeMutualCheckedRecordNpmPins(previous);
};
