/**
 * Reverse the authenticated installed JavaScript owned-Subtype transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeJavaScriptHistoryPath
	= "docs/evidence/owned-subtype-javascript-source-history-20261020.json";
export const ownedSubtypeJavaScriptEvidencePath
	= "docs/evidence/owned-subtype-javascript-acceptance-20261020.json";
export const ownedSubtypeJavaScriptPredecessor
	= "3297fb2507379e0b06e2abcf0d3f048c8eebb447";
export const ownedSubtypeJavaScriptImplementation
	= "9ee8b62dffcf899abdc168a9abd8c94cc92d1413";
export const ownedSubtypeJavaScriptChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "docs/javascript-typescript.md"
	, "docs/lean/diagnostics.md"
	, "docs/lean/existing-package.md"
	, "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "src/build/owned-aggregate-carriers.mjs"
	, "src/build/owned-native-model.mjs"
	, "tests/fixtures/onboarding/owned-subtypes/Owned.lean"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/owned-aggregate-fixture.mjs"
	, "tests/helpers/owned-refinement-carriers-source-history-tests.mjs"
	, "tests/helpers/owned-refinement-model-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-analysis-source-history-tests.mjs"
	, "tests/engine-execution-request.test.mjs"
	, "tests/owned-aggregate-model.test.mjs"
	, "tests/owned-javascript-wasm-native.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeJavaScriptHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeJavaScriptUpdate = (source, update) => {
	assert.ok(ownedSubtypeJavaScriptChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this exact installed JavaScript owned-Subtype transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeJavaScriptSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !ownedSubtypeJavaScriptChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseOwnedSubtypeJavaScriptUpdate(source, update) : source;
};

/**
 * Bridge two older type-surface pointer transitions whose original history
 * records omitted the post-implementation writer edits.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeJavaScriptHistoricalSource
	= (path, source, expected) => {
		if(typeof source !== "string") return source;
		const corrections = record().historicalCorrections
			.filter(update => update.path === path);
		if(corrections.length === 0) return source;
		for(const update of corrections)
		{
			if(sha256(source) === expected) return source;
			if(update.currentSha256 === sha256(source))
				source = reverseOwnedSubtypeJavaScriptUpdate(source, update);
		}
		return source;
	};
