/**
 * Preserve the exact predecessors of the checked native Fin admission (#1418).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNpmFinDiagnosticsSource } from "./npm-fin-diagnostics-source-history.mjs";

export const nativeFinHistoryPath = "docs/evidence/native-fin-source-history-20261005.json";
export const nativeFinChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/lean/existing-package.md"
	, "docs/type-surface.v1.json"
	, "package.json"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/native-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/build/multi-profile-project.mjs"
	, "src/build/native-artifacts.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-component.mjs"
	, "src/build/native-graph-model.mjs"
	, "src/build/native-model.mjs"
	, "src/build/native-project.mjs"
	, "src/release/native-c-family.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/perl-evidence-repair-source-history-tests.mjs"
	, "tests/helpers/perl-evidence-repair-source-history.mjs"
];
let history;

/**
 * Reverse exact spans only when both complete source identities agree.
 *
 * @param source - Complete current text.
 * @param update - Recorded transition.
 */
export const reverseNativeFinUpdate = (source, update) => {
	assert.ok(nativeFinChangedPaths.includes(update.path));
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
 * Undo only the checked native Fin admission (#1418) before following older refinement transitions.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNativeFinSource = (path, source, expected) => {
	source = beforeNpmFinDiagnosticsSource(path, source, expected);
	if(typeof source !== "string" || !nativeFinChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nativeFinHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeFinUpdate(source, update) : source;
};
