/**
 * Preserve exact source predecessors when integrating installed WIT dispatch measurements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeInheritedRecordArchiveSource } from "./inherited-record-archive-source-history.mjs";

export const witDispatchIntegrationHistoryPath = "docs/evidence/wit-dispatch-integration-source-history-20261008.json";
export const witDispatchIntegrationPredecessor = "5dd16b52a540f9da88a6611d6877073c1257a0c8";
export const witDispatchIntegrationChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/wit-fin.test.mjs"
	, "tests/php-fin-dispatch-evidence.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-record-promotion-source-history.mjs"
	, "tests/helpers/reviewed-record-promotion-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseWitDispatchIntegrationUpdate = (source, update) => {
	assert.ok(witDispatchIntegrationChangedPaths.includes(update.path));
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
 * Restore the pre-integration source, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeWitDispatchIntegrationSource = (path, source, expected) => {
	source = beforeInheritedRecordArchiveSource(path, source, expected);
	if(typeof source !== "string" || !witDispatchIntegrationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(witDispatchIntegrationHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseWitDispatchIntegrationUpdate(source, update) : source;
};
