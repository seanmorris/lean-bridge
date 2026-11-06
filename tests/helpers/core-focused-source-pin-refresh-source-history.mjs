/**
 * Preserve the complete current-source pin refresh for the focused Core repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreFocusedSourcePinRefreshHistoryPath
	= "docs/evidence/core-focused-source-pin-refresh-source-history-20261106.json";
export const coreFocusedSourcePinRefreshPredecessor
	= "426a83fb30a3e2c0aecbc2967a7b9ead042300e3";
export const coreFocusedSourcePinRefreshImplementation
	= "2d4615255a1c3ab9dbc53057d7389c7ca54a6b43";
export const coreFocusedSourcePinRefreshImplementationCurrentSources
	= Object.freeze([
		"docs/consume/cpp.md"
		, "docs/consume/dotnet.md"
		, "docs/consume/java.md"
		, "docs/consume/kotlin.md"
		, "docs/consume/rust.md"
		, "docs/consume/wit-wasi.md"
		, "scripts/generate-type-docs.mjs"
		, "tests/type-surface-docs.test.mjs"
	]);
export const coreFocusedSourcePinRefreshCurrentSources = Object.freeze([
	...coreFocusedSourcePinRefreshImplementationCurrentSources
]);
export const coreFocusedSourcePinRefreshImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const coreFocusedSourcePinRefreshIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreFocusedSourcePinRefreshHistoryAdditions = Object.freeze([
	"scripts/update-core-focused-source-pin-refresh-source-history.mjs"
	, "tests/helpers/core-focused-source-pin-refresh-source-history-tests.mjs"
	, "tests/helpers/core-focused-source-pin-refresh-source-history.mjs"
]);
export const coreFocusedSourcePinRefreshNormalizationPaths = Object.freeze([
	...new Set([
		...coreFocusedSourcePinRefreshImplementationPaths
		, ...coreFocusedSourcePinRefreshIntegrationPaths
	])
].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreFocusedSourcePinRefreshHistoryPath, "utf8"));

/**
 * Reverse one authenticated current-source pin transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseCoreFocusedSourcePinRefreshUpdate = (source, update) => {
	assert.ok(coreFocusedSourcePinRefreshNormalizationPaths
		.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove the integration refresh before its implementation refresh.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeCoreFocusedSourcePinRefreshSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreFocusedSourcePinRefreshNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [
		record().integrationUpdates, record().implementationUpdates
	]) {
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreFocusedSourcePinRefreshUpdate(current, update);
	}
	return current;
};
