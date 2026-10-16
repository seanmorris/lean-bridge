/**
 * Authenticate exact checked-refinement diagnostics in recursive Ruby graph gems.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforePythonGraphDiagnosticPins
	, beforePythonGraphDiagnosticSource
} from "./python-graph-diagnostic-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const rubyGraphDiagnosticHistoryPath
	= "docs/evidence/ruby-graph-diagnostic-source-history-20261016.json";
export const rubyGraphDiagnosticPredecessor
	= "c3cf933a23e0218ffd4c2189c8158e616539ef6b";
export const rubyGraphDiagnosticDraftParent
	= "c3cf933a23e0218ffd4c2189c8158e616539ef6b";
export const rubyGraphDiagnosticChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/backends/ruby/copied-graph-conversions.mjs"
	, "src/backends/ruby/copied-graph-package.mjs"
	, "src/release/native-rubygems.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/python-graph-diagnostic-source-history-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseRubyGraphDiagnosticUpdate = (source, update) => {
	assert.ok(rubyGraphDiagnosticChangedPaths.includes(update.path));
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
 * Remove only this Ruby graph diagnostic transition at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutRubyGraphDiagnostic = (path, source) => {
	if(typeof source !== "string"
		|| !rubyGraphDiagnosticChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		rubyGraphDiagnosticHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseRubyGraphDiagnosticUpdate(source, update) : source;
};

/**
 * Reverse this transition, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRubyGraphDiagnosticSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !rubyGraphDiagnosticChangedPaths.includes(path))
		return beforePythonGraphDiagnosticSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutRubyGraphDiagnostic(path, source);
	if(previous !== source) return previous;
	return beforePythonGraphDiagnosticSource(path, source, expected);
};

/**
 * Restore source pins through this transition and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeRubyGraphDiagnosticPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		rubyGraphDiagnosticHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforePythonGraphDiagnosticPins(previous);
};
