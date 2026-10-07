/**
 * Preserve the exact predecessors of the nominal Fin admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeCallbackFinSource } from "./callback-fin-source-history.mjs";

export const nominalFinHistoryPath = "docs/evidence/npm-nominal-fin-source-history-20261005.json";
export const nominalFinChangedPaths = [
	"docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "schema/compiler-adapter-plan.schema.json"
	, "src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/copied-metadata-graph.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/javascript/copied-validators.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-recursive-adapters.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/lean-component-compiler.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/refinement-closure-source-history-tests.mjs"
	, "tests/helpers/refinement-closure-source-history.mjs"
	, "tests/unlocked-component.test.mjs"
];
let history;

/**
 * Reverse exact spans only when both complete source identities agree.
 *
 * @param source - Complete current text.
 * @param update - Recorded transition.
 */
export const reverseNominalFinUpdate = (source, update) => {
	assert.ok(nominalFinChangedPaths.includes(update.path));
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
 * Undo only the nominal Fin admission before following older refinement transitions.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNominalFinSource = (path, source, expected) => {
	source = beforeCallbackFinSource(path, source, expected);
	if(typeof source !== "string" || !nominalFinChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalFinHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalFinUpdate(source, update) : source;
};
