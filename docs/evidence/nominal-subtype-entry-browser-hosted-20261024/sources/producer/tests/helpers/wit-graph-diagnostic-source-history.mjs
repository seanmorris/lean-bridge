/**
 * Authenticate exact checked-refinement diagnostics in WIT graph packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforePhpGraphDiagnosticPins
	, beforePhpGraphDiagnosticSource
} from "./php-graph-diagnostic-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const witGraphDiagnosticHistoryPath
	= "docs/evidence/wit-graph-diagnostic-source-history-20261017.json";
export const witGraphDiagnosticPredecessor
	= "1ffbd65e3de77eb006a353502cd58ff59d0e8f13";
export const witGraphDiagnosticDraftParent
	= "1ffbd65e3de77eb006a353502cd58ff59d0e8f13";
export const witGraphDiagnosticChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/backends/wit/copied-graph-host.mjs"
	, "src/backends/wit/copied-graph-package.mjs"
	, "src/build/native-wit-artifacts.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseWitGraphDiagnosticUpdate = (source, update) => {
	assert.ok(witGraphDiagnosticChangedPaths.includes(update.path));
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
 * Remove only this WIT graph diagnostic transition at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutWitGraphDiagnostic = (path, source) => {
	if(typeof source !== "string"
		|| !witGraphDiagnosticChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		witGraphDiagnosticHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseWitGraphDiagnosticUpdate(source, update) : source;
};

/**
 * Reverse this transition, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeWitGraphDiagnosticSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !witGraphDiagnosticChangedPaths.includes(path))
		return beforePhpGraphDiagnosticSource(path, source, expected);
	let digest = sha256(source);
	if(digest === expected) return source;
	const previous = withoutWitGraphDiagnostic(path, source);
	if(previous !== source)
	{
		source = previous;
		digest = sha256(source);
		if(digest === expected) return source;
	}
	return beforePhpGraphDiagnosticSource(path, source, expected);
};

/**
 * Restore source pins through this transition and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeWitGraphDiagnosticPins = inventory => {
	const record = history ??= JSON.parse(readFileSync(
		witGraphDiagnosticHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path
		=== "docs/type-surface.v1.json");
	const current = JSON.stringify(inventory, null, 2) + "\n";
	const previous = update?.currentSha256 === sha256(current)
		? JSON.parse(reverseWitGraphDiagnosticUpdate(current, update))
		: structuredClone(inventory);
	return beforePhpGraphDiagnosticPins(previous);
};
