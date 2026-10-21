/**
 * Authenticate exact checked-refinement diagnostics in recursive Rust crates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeRubyMemberEscapePins
	, beforeRubyMemberEscapeSource
} from "./ruby-member-escape-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const rustGraphDiagnosticHistoryPath
	= "docs/evidence/rust-graph-diagnostic-source-history-20261017.json";
export const rustGraphDiagnosticPredecessor
	= "8b780f77bbec2ac188ef550ab9862edf758c981c";
export const rustGraphDiagnosticDraftParent
	= "8b780f77bbec2ac188ef550ab9862edf758c981c";
export const rustGraphDiagnosticChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/backends/rust/copied-graph-package.mjs"
	, "src/build/native-rust-projection.mjs"
	, "src/release/native-cargo.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseRustGraphDiagnosticUpdate = (source, update) => {
	assert.ok(rustGraphDiagnosticChangedPaths.includes(update.path));
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
 * Remove only this Rust graph diagnostic transition at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutRustGraphDiagnostic = (path, source) => {
	if(typeof source !== "string"
		|| !rustGraphDiagnosticChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		rustGraphDiagnosticHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseRustGraphDiagnosticUpdate(source, update) : source;
};

/**
 * Reverse this transition, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRustGraphDiagnosticSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !rustGraphDiagnosticChangedPaths.includes(path))
		return beforeRubyMemberEscapeSource(path, source, expected);
	let digest = sha256(source);
	if(digest === expected) return source;
	const previous = withoutRustGraphDiagnostic(path, source);
	if(previous !== source)
	{
		source = previous;
		digest = sha256(source);
		if(digest === expected) return source;
	}
	return beforeRubyMemberEscapeSource(path, source, expected);
};

/**
 * Restore source pins through this transition and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeRustGraphDiagnosticPins = inventory => {
	const record = history ??= JSON.parse(readFileSync(
		rustGraphDiagnosticHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path
		=== "docs/type-surface.v1.json");
	const current = JSON.stringify(inventory, null, 2) + "\n";
	const previous = update?.currentSha256 === sha256(current)
		? JSON.parse(reverseRustGraphDiagnosticUpdate(current, update))
		: structuredClone(inventory);
	return beforeRubyMemberEscapePins(previous);
};
