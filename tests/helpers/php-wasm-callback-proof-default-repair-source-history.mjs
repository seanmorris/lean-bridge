/**
 * Authenticate the proof-preserving PHP-Wasm callback recovery repair found
 * by the final #1220 activation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCallbackProofDefaultRepairHistoryPath
	= "docs/evidence/php-wasm-callback-proof-default-repair-source-history-20261111.json";
export const phpWasmCallbackProofDefaultRepairPredecessor
	= "7f09a73bd30a45feb41bc99d1cb53a897fa797e3";
export const phpWasmCallbackProofDefaultRepairImplementation
	= "f52648c546ab6f2b0bc45b7f1fb2943d036bd504";
export const phpWasmCallbackProofDefaultRepairImplementationPaths
	= Object.freeze([
		"src/build/component-structured-callable-lean.mjs"
		, "tests/callback-checked-record-native.test.mjs"
		, "tests/component-structured-callable-defaults.test.mjs"
	]);
export const phpWasmCallbackProofDefaultRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/component-array-history-partition-04.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const phpWasmCallbackProofDefaultRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-php-wasm-callback-proof-default-repair-source-history.mjs"
		, "tests/helpers/php-wasm-callback-proof-default-repair-source-history-tests.mjs"
		, "tests/helpers/php-wasm-callback-proof-default-repair-source-history.mjs"
	]);
export const phpWasmCallbackProofDefaultRepairNormalizationPaths
	= Object.freeze([...phpWasmCallbackProofDefaultRepairImplementationPaths
		, ...phpWasmCallbackProofDefaultRepairIntegrationPaths].sort());
export const phpWasmCallbackProofDefaultRepairBehavior = Object.freeze({
	proofErasedDefaults: "authenticated payload mirrors"
	, ordinaryRefinedDefaults: "source values"
	, impossibleSourceFallbacks: "rejected"
	, runtimeSemanticChanges: 0
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmCallbackProofDefaultRepairHistoryPath, "utf8"));
const allowedPath = path =>
	phpWasmCallbackProofDefaultRepairNormalizationPaths.includes(path);

/**
 * Reverse one exact transition after authenticating both endpoints.
 *
 * @param source - Complete later source.
 * @param update - Recorded inverse transition.
 */
export const reversePhpWasmCallbackProofDefaultRepairUpdate = (
	source, update
) => {
	assert.ok(allowedPath(update.path), update.path);
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
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
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
 * Remove only the authenticated proof-default repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforePhpWasmCallbackProofDefaultRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || !allowedPath(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reversePhpWasmCallbackProofDefaultRepairUpdate(
				current, update);
	}
	return current;
};
