/**
 * Authenticate the reviewed Wasm Fin-field corpus extension without rewriting
 * the earlier scalar and structural evidence histories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const reviewedFinWasmFieldHistoryPath
	= "docs/evidence/reviewed-fin-wasm-field-source-history-20261028.json";
export const reviewedFinWasmFieldPredecessor
	= "e18a9a306853c6a720927d50befc05c11e84044c";
export const reviewedFinWasmFieldImplementation
	= "5ab44cd61391ca1839b0b3faee607a448ad39274";
export const reviewedFinWasmFieldChangedPaths = Object.freeze([
	"tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean"
	, "tests/fixtures/reviewed-fin-wasm/javascript.mjs"
	, "tests/helpers/reviewed-fin-wasm-contract-tests.mjs"
	, "tests/helpers/reviewed-fin-wasm-entry.mjs"
	, "tests/helpers/reviewed-fin-wasm-fixture.mjs"
	, "tests/helpers/reviewed-fin-wasm-install.mjs"
	, "tests/helpers/reviewed-fin-wasm-mismatches.mjs"
	, "tests/helpers/reviewed-fin-wasm-source-entry.mjs"
	, "tests/helpers/reviewed-fin-wasm-typescript.mjs"
	, "tests/reviewed-fin-wasm-entry-controls.test.mjs"
]);
export const reviewedFinWasmFieldIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-07.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const reviewedFinWasmFieldNormalizationPaths = Object.freeze([
	...reviewedFinWasmFieldChangedPaths, ...reviewedFinWasmFieldIntegrationPaths
].toSorted());
export const reviewedFinWasmFieldAddedPaths = Object.freeze([
	"scripts/update-reviewed-fin-wasm-field-source-history.mjs"
	, "tests/helpers/reviewed-fin-wasm-field-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-wasm-field-source-history.mjs"
]);
export const reviewedFinWasmFieldPins = Object.freeze([
	Object.freeze({
		path: "tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean", count: 4
		, previousSha256: "367274a75a77938d2358e5b7106937cca0737025e3f887578d76544372b9ba07"
		, currentSha256: "e2ed5255a2887c608c83cd9e79a519aca2c5d66e090324f8d248da3e8f9d0d0c" })
	, Object.freeze({
		path: "tests/fixtures/reviewed-fin-wasm/javascript.mjs", count: 4
		, previousSha256: "dcab9f420cd1f7b4d8363cf0de7ddf94f6e6cd610a9a885eefe1987aab86be4a"
		, currentSha256: "20708ba30375381aa34738f9a6713d80103eb4f570b8281fd6fad81552255ebe" })
	, Object.freeze({ path: "tests/helpers/reviewed-fin-wasm-fixture.mjs", count: 4
		, previousSha256: "fbbb18d5875d51ffa74b16d62280bd7d28bf11d85f390429737dd9ae8a4a7625"
		, currentSha256: "a9931a73a5c50f695fdac6c0c12dd926ecaf4c37f161dc9a1bda2de1bc61e613" })
	, Object.freeze({ path: "tests/helpers/reviewed-fin-wasm-install.mjs", count: 4
		, previousSha256: "8e0bff658d5ff10d8a62d1021562969d7fcb1a9a95ae2b50ba524b2eb0dc5cd8"
		, currentSha256: "286f7e65dfa82149a9f21bf48e9bdf6fbdca6c49da0a3169090a07dbc6937b91" })
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(reviewedFinWasmFieldHistoryPath, "utf8"));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseReviewedFinWasmFieldUpdate = (source, update) => {
	assert.ok(reviewedFinWasmFieldNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only the exact reviewed Wasm Fin-field transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeReviewedFinWasmFieldSource = (path, source, expected) => {
	if(typeof source !== "string" || !reviewedFinWasmFieldNormalizationPaths.includes(path)) return source;
	const value = record(), updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseReviewedFinWasmFieldUpdate(current, update);
	}
	return current;
};
