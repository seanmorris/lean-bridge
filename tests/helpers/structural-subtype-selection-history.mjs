/**
 * Authenticate structural Subtype constructor selection evidence registration without rewriting earlier source receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeStructuralSubtypeRuntimeSource } from "./structural-subtype-runtime-history.mjs";

export const structuralSubtypeSelectionHistoryPath = "docs/evidence/structural-subtype-selection-source-history-20261011.json";
export const structuralSubtypeSelectionPredecessor = "452c96b1df39e5faec7f8b8bbd95e475736e7921";
export const structuralSubtypeSelectionChangedPaths = [
	"config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "schema/lean-export-configuration.schema.json"
	, "src/analyze/export-configuration.mjs"
	, "tests/export-configuration.test.mjs"
	, "docs/type-surface.v1.json"
	, "tests/helpers/checked-record-perl-author-docs-history.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseStructuralSubtypeSelectionUpdate = (source, update) => {
	assert.ok(structuralSubtypeSelectionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Preserve unknown edits and exact requested stopping points.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeStructuralSubtypeSelectionSource = (path, source, expected) => {
	source = beforeStructuralSubtypeRuntimeSource(path, source, expected);
	if(typeof source !== "string" || !structuralSubtypeSelectionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(structuralSubtypeSelectionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseStructuralSubtypeSelectionUpdate(source, update) : source;
};
