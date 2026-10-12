/**
 * Preserve source identities when adding retained JVM container-entry exit observation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const jvmContainerEntryExitHistoryPath = "docs/evidence/jvm-container-entry-exit-source-history-20261012.json";
export const jvmContainerEntryExitPredecessor = "42bd530c3c1edab1fe5764144f7965f845b69f81";
export const jvmContainerEntryExitChangedPaths = [
	"tests/fin-container-entry-ci.test.mjs"
	, "tests/fin-container-entry-dispatch.test.mjs"
	, "tests/helpers/fin-container-dispatch-gdb-extracted.mjs"
	, "tests/helpers/fin-container-entry-ci.mjs"
	, "tests/helpers/fin-container-entry-probes.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-failure-diagnostics-history.mjs"
];
let history;

/**
 * Reverse only exact complete-source transitions with authenticated spans.
 *
 * @param source - Complete current source.
 * @param update - Immutable source transition.
 */
export const reverseJvmContainerEntryExitUpdate = (source, update) => {
	assert.ok(jvmContainerEntryExitChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
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
 * Keep unknown edits and honor explicit intermediate stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeJvmContainerEntryExitSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !jvmContainerEntryExitChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(jvmContainerEntryExitHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseJvmContainerEntryExitUpdate(source, update) : source;
};
