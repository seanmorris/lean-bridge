/**
 * Preserve the exact callback-refinement PHP-Wasm hosted archive and verifier
 * while allowing earlier source milestones to be reconstructed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackRefinementsPhpWasmHostedArchiveHistoryPath
	= "docs/evidence/callback-refinements-php-wasm-hosted-archive-source-history-20261023.json";
export const callbackRefinementsPhpWasmHostedArchivePredecessor
	= "9a6effe9e4fac64f222997e00d5b87c0c50f409a";
export const callbackRefinementsPhpWasmHostedArchiveFoundation
	= "b419c5c84ef45c678bdc14bbb42f7115966f7d3a";
export const callbackRefinementsPhpWasmHostedArchiveCommit
	= "d09cbad0eda402ef75d3479a4177be007b073f7a";
export const callbackRefinementsPhpWasmHostedArchiveVerifier
	= "7d31b523986a3e897241861f73074229b0206d42";
export const callbackRefinementsPhpWasmHostedArchiveRoot
	= "docs/evidence/callback-refinements-php-wasm-20261023";
export const callbackRefinementsPhpWasmHostedArchiveIndexSha256
	= "297895d119c12fd4dde45763fc18271774a62a6de1130de070528145f7a11208";
export const callbackRefinementsPhpWasmHostedArchiveIndexedFileCount = 2348;
export const callbackRefinementsPhpWasmHostedArchiveFileCount = 2349;
export const callbackRefinementsPhpWasmHostedArchiveFoundationAddedPaths
	= Object.freeze([
		"scripts/archive-callback-refinements-php-wasm-evidence.mjs"
		, "tests/helpers/callback-refinements-php-wasm-hosted-archive-tests.mjs"
		, "tests/helpers/callback-refinements-php-wasm-hosted-evidence-sources.mjs"
	]);
export const callbackRefinementsPhpWasmHostedArchiveFoundationUpdatedPaths
	= Object.freeze(["tests/callback-refinements-php-wasm.test.mjs"]);
export const callbackRefinementsPhpWasmHostedArchiveVerifierAddedPaths
	= Object.freeze([
		"tests/helpers/callback-refinements-php-wasm-hosted-evidence-tests.mjs"
		, "tests/helpers/callback-refinements-php-wasm-hosted-evidence.mjs"
	]);
export const callbackRefinementsPhpWasmHostedArchiveVerifierUpdatedPaths
	= Object.freeze(["tests/callback-refinements-php-wasm.test.mjs"]);
export const callbackRefinementsPhpWasmHostedArchiveIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
	]);
export const callbackRefinementsPhpWasmHostedArchiveNormalizationPaths
	= Object.freeze([...new Set([
		...callbackRefinementsPhpWasmHostedArchiveFoundationUpdatedPaths
		, ...callbackRefinementsPhpWasmHostedArchiveVerifierUpdatedPaths
		, ...callbackRefinementsPhpWasmHostedArchiveIntegrationPaths
	])]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackRefinementsPhpWasmHostedArchiveHistoryPath, "utf8"));
const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
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
 * Reverse one exact archive-foundation source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackRefinementsPhpWasmHostedArchiveFoundation = (
	source, update
) => reverse(source, update
	, callbackRefinementsPhpWasmHostedArchiveFoundationUpdatedPaths);

/**
 * Reverse one exact hosted-verifier source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackRefinementsPhpWasmHostedArchiveVerifier = (
	source, update
) => reverse(source, update
	, callbackRefinementsPhpWasmHostedArchiveVerifierUpdatedPaths);

/**
 * Reverse one exact history-integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackRefinementsPhpWasmHostedArchiveIntegration = (
	source, update
) => reverse(source, update
	, callbackRefinementsPhpWasmHostedArchiveIntegrationPaths);

/**
 * Remove only this exact archive/verifier milestone from a current or
 * historical source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeCallbackRefinementsPhpWasmHostedArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackRefinementsPhpWasmHostedArchiveNormalizationPaths.includes(path))
		return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const transitions = [
		[record().integrationUpdates
			, reverseCallbackRefinementsPhpWasmHostedArchiveIntegration]
		, [record().verifierUpdates
			, reverseCallbackRefinementsPhpWasmHostedArchiveVerifier]
		, [record().foundationUpdates
			, reverseCallbackRefinementsPhpWasmHostedArchiveFoundation]
	];
	for(const [updates, reverseUpdate] of transitions)
	{
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(!update) continue;
		source = reverseUpdate(source, update);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	return source;
};
