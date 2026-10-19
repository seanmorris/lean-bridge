/**
 * Authenticate the Perl structural Subtype assertion repair without changing installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeCheckedRecordBrowserArchiveSource } from "./checked-record-browser-archive-history.mjs";

export const perlContainerSubtypeCiHistoryPath = "docs/evidence/perl-container-subtype-ci-source-history-20261011.json";
export const perlContainerSubtypeCiPredecessor = "ccc372392997ea0de2ef72a1b29474df96e3af39";
export const perlContainerSubtypeCiChangedPaths = [
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-fin-nix-comparison-history.mjs"
	, "tests/perl-fin-containers.test.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reversePerlContainerSubtypeCiUpdate = (source, update) => {
	assert.ok(perlContainerSubtypeCiChangedPaths.includes(update.path));
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
export const beforePerlContainerSubtypeCiSource = (path, source, expected) => {
	source = beforeCheckedRecordBrowserArchiveSource(path, source, expected);
	if(typeof source !== "string" || !perlContainerSubtypeCiChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(perlContainerSubtypeCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePerlContainerSubtypeCiUpdate(source, update) : source;
};

