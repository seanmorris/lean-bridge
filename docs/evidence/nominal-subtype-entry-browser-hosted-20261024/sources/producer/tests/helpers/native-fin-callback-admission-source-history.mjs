/**
 * Preserve exact source predecessors of the Native Fin callback admission change (#1220).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeReviewedSubtypeAdmissionSource } from "./reviewed-subtype-admission-source-history.mjs";

export const nativeFinCallbackAdmissionHistoryPath = "docs/evidence/native-fin-callback-admission-source-history-20261008.json";
export const nativeFinCallbackAdmissionChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/lean/existing-package.md"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/backends/c/native-callables.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/build/multi-profile-project.mjs"
	, "src/build/native-artifacts.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-component.mjs"
	, "src/build/native-graph-model.mjs"
	, "src/build/native-model.mjs"
	, "src/build/native-project.mjs"
	, "src/release/native-c-family.mjs"
	, "tests/documentation.test.mjs"
	, "tests/native-fin-containers.test.mjs"
	, "tests/native-fin.test.mjs"
	, "docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-specialization-ci-hotfix-source-history.mjs"
	, "tests/helpers/reviewed-specialization-ci-hotfix-source-history-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNativeFinCallbackAdmissionUpdate = (source, update) => {
	assert.ok(nativeFinCallbackAdmissionChangedPaths.includes(update.path));
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
 * Restore the source before #1220, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNativeFinCallbackAdmissionSource = (path, source, expected) => {
	source = beforeReviewedSubtypeAdmissionSource(path, source, expected);
	if(typeof source !== "string" || !nativeFinCallbackAdmissionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nativeFinCallbackAdmissionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeFinCallbackAdmissionUpdate(source, update) : source;
};
