/**
 * Preserve exact predecessors when measuring public C++ scalar Fin entries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const cppFinDispatchIntegrationHistoryPath = "docs/evidence/cpp-fin-dispatch-integration-source-history-20261009.json";
export const cppFinDispatchIntegrationPredecessor = "8e627ded0b646c514d8d8ec7c6fc16416c812adb";
export const cppFinDispatchIntegrationChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/native-fin.test.mjs"
	, "tests/helpers/reviewed-fin-refusal-ci-source-history.mjs"
	, "tests/helpers/reviewed-fin-refusal-ci-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/reviewed-fin-refusal-history.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCppFinDispatchIntegrationUpdate = (source, update) => {
	assert.ok(cppFinDispatchIntegrationChangedPaths.includes(update.path));
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
 * Restore the source before C++ entry-counter integration, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCppFinDispatchIntegrationSource = (path, source, expected) => {
	if(typeof source !== "string" || !cppFinDispatchIntegrationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(cppFinDispatchIntegrationHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCppFinDispatchIntegrationUpdate(source, update) : source;
};
