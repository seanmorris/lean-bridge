/**
 * Preserve exact source predecessors of the Checked-record admission change (#1220).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinPythonRubyArchiveSource } from "./fin-python-ruby-archive-source-history.mjs";

export const checkedRecordAdmissionHistoryPath = "docs/evidence/checked-record-admission-source-history-20261008.json";
export const checkedRecordAdmissionChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/evidence/refinement-closure-audit-20261007.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "schema/compiler-adapter-plan.schema.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "schema/native-metadata-type.schema.json"
	, "src/abi/component-records.mjs"
	, "src/abi/component-recursive.mjs"
	, "src/abi/refinements.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-instantiation.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-subtypes.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-artifacts.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-model.mjs"
	, "src/release/native-c-family.mjs"
	, "tests/helpers/json-schema.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/subtype-xs-archive-source-history.mjs"
	, "tests/helpers/subtype-xs-archive-source-history-tests.mjs"
	, "tests/native-subtype.test.mjs"
	, "docs/type-surface.v1.json"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCheckedRecordAdmissionUpdate = (source, update) => {
	assert.ok(checkedRecordAdmissionChangedPaths.includes(update.path));
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
export const beforeCheckedRecordAdmissionSource = (path, source, expected) => {
	source = beforeFinPythonRubyArchiveSource(path, source, expected);
	if(typeof source !== "string" || !checkedRecordAdmissionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordAdmissionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordAdmissionUpdate(source, update) : source;
};
