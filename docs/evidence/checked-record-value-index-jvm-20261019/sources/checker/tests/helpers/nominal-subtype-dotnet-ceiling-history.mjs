/**
 * Authenticate the exact C# test transition of the bounded per-run producer load ceilings (e15acb5)
 * so the older C# CI and promotion ledgers can still reverse the current source to their epochs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypeDotnetCeilingHistoryPath = "docs/evidence/nominal-subtype-dotnet-ceiling-source-history-20261015.json";
export const nominalSubtypeDotnetCeilingPredecessor = "763a841395bf705c880b9e406a60220a547143e3";
export const nominalSubtypeDotnetCeilingChangedPaths = ["tests/helpers/nominal-subtype-dotnet-tests.mjs"];
let history;

/**
 * Restore a complete transition only when both file digests and every span match.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseNominalSubtypeDotnetCeilingUpdate = (source, update) => {
	assert.ok(nominalSubtypeDotnetCeilingChangedPaths.includes(update.path));
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
 * Keep unknown edits and honor exact requested stopping points. This layer is reached through the
 * primitive-base history repair, so it calls no newer layer itself.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeNominalSubtypeDotnetCeilingSource = (path, source, expected) => {
	if(typeof source !== "string" || !nominalSubtypeDotnetCeilingChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeDotnetCeilingHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeDotnetCeilingUpdate(source, update) : source;
};
