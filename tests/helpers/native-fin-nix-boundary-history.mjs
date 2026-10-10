/**
 * Preserve the exact source pins before adding Fin diagnostics to the Nix engine.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finNixBoundaryHistoryPath = "docs/evidence/native-fin-nix-boundary-source-history-20261010.json";
export const finNixBoundaryPredecessor = "a1916306286ae10ce6568e94116fdc2f6b1d7411";
export const finNixBoundaryChangedPaths = ["docs/type-surface.v1.json", "nix/perl-engine-source-boundary.json"];
let history;

/**
 * Reverse only the registered spans with authenticated complete source hashes.
 *
 * @param source - Complete UTF-8 source text.
 * @param update - Recorded transition.
 */
export const reverseFinNixBoundaryUpdate = (source, update) => {
	assert.ok(finNixBoundaryChangedPaths.includes(update.path));
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
 * Restore known predecessors and leave requested or unknown source bytes intact.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeFinNixBoundarySource = (path, source, expected) => {
	if(typeof source !== "string" || !finNixBoundaryChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(finNixBoundaryHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseFinNixBoundaryUpdate(source, update) : source;
};
