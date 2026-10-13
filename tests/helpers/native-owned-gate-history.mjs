/**
 * Preserve original native ownership evidence across the live CI gate repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nativeOwnedGateHistoryPath = "docs/evidence/native-owned-gate-source-history-20261013.json";
export const nativeOwnedGatePredecessor = "70285c8cfc5ae0251adec4ba55a70ea2386a9869";
export const nativeOwnedGateChangedPaths = [
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-jvm-registration-history.mjs"
	, "tests/helpers/nominal-subtype-perl-ci-workflow-tests.mjs"
	, "tests/helpers/owned-cpp-transfer-evidence.mjs"
	, "tests/helpers/owned-transfer-c-evidence.mjs"
	, "tests/helpers/owned-transfer-package-evidence.mjs"
	, "tests/owned-aggregate-native.test.mjs"
	, "tests/owned-c-values.test.mjs"
	, "tests/owned-cpp-packaging.test.mjs"
	, "tests/owned-host-callbacks.test.mjs"
	, "tests/owned-host-packaging.test.mjs"
	, "tests/owned-native-values.test.mjs"
];
let history;

/**
 * Reverse only authenticated complete sources and non-overlapping literal spans.
 *
 * @param source - Complete current source text.
 * @param update - Immutable exact predecessor transition.
 */
export const reverseNativeOwnedGateUpdate = (source, update) => {
	assert.ok(nativeOwnedGateChangedPaths.includes(update.path));
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
 * Keep unknown changes visible and stop at a requested historical identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional stopping digest.
 */
export const beforeNativeOwnedGateSource = (path, source, expected) => {
	if(typeof source !== "string" || !nativeOwnedGateChangedPaths.includes(path)) return source;
	const digest = sha256(source); if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nativeOwnedGateHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeOwnedGateUpdate(source, update) : source;
};
