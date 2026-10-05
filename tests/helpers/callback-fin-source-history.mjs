/**
 * Preserve the exact predecessors of the callback Fin admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const callbackFinHistoryPath = "docs/evidence/npm-callback-fin-source-history-20261005.json";
export const callbackFinChangedPaths = [
	"docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "schema/compiler-adapter-plan.schema.json"
	, "src/abi/component-structured-callables.mjs"
	, "src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/javascript/copied-validators.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-recursive-adapters.mjs"
	, "src/build/component-structured-callable-adapters.mjs"
	, "src/build/component-structured-callable-defaults.mjs"
	, "src/build/component-structured-callable-lean.mjs"
	, "src/release/component-npm-package.mjs"
	, "src/release/component-runtime.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
	, "tests/component-structured-callable-defaults.test.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-fin-contract-tests.mjs"
	, "tests/helpers/nominal-fin-source-history-tests.mjs"
	, "tests/helpers/nominal-fin-source-history.mjs"
	, "tests/unlocked-component.test.mjs"
];
let history;

/**
 * Reverse exact spans only when both complete source identities agree.
 *
 * @param source - Complete current text.
 * @param update - Recorded transition.
 */
export const reverseCallbackFinUpdate = (source, update) => {
	assert.ok(callbackFinChangedPaths.includes(update.path));
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
 * Undo only the callback Fin admission before following older refinement transitions.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCallbackFinSource = (path, source, expected) => {
	if(typeof source !== "string" || !callbackFinChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(callbackFinHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCallbackFinUpdate(source, update) : source;
};
