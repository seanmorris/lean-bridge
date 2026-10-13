/**
 * Preserve scalar Fin producer identities when adding exact-child JVM exit observation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypeJvmCiSource } from "./nominal-subtype-jvm-ci-history.mjs";

export const nativeFinJvmExitHistoryPath = "docs/evidence/native-fin-jvm-exit-source-history-20261013.json";
export const nativeFinJvmExitPredecessor = "50a5cf414a914a3906ccf7676eb4006427b8ecd8";
export const nativeFinJvmExitChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/jvm-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/native-fin-dispatch-gdb-extracted.mjs"
	, "tests/helpers/native-owned-gate-history.mjs"
	, "tests/jvm-fin-dispatch-evidence.test.mjs"
	, "tests/jvm-fin.test.mjs"
];
let history;

/**
 * Reverse only complete-source transitions with authenticated non-overlapping spans.
 *
 * @param source - Complete current source.
 * @param update - Immutable predecessor transition.
 */
export const reverseNativeFinJvmExitUpdate = (source, update) => {
	assert.ok(nativeFinJvmExitChangedPaths.includes(update.path));
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
	const previous = parts.join(""); assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Keep unknown changes visible and stop at a requested historical digest.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional stopping digest.
 */
export const beforeNativeFinJvmExitSource = (path, source, expected) => {
	source = beforeNominalSubtypeJvmCiSource(path, source, expected);
	if(typeof source !== "string" || !nativeFinJvmExitChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nativeFinJvmExitHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeFinJvmExitUpdate(source, update) : source;
};
