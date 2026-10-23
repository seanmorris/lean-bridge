/**
 * Reverse the callback Subtype hosted-archive foundation transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeHostedArchiveFoundationHistoryPath
	= "docs/evidence/callback-subtype-hosted-archive-foundation-source-history-20261022.json";
export const callbackSubtypeHostedArchiveFoundationPredecessor
	= "46dd16641b6a7fcb756553cb13eea70bef3614d4";
export const callbackSubtypeHostedArchiveFoundationImplementation
	= "fe90a7fa3170f1633a3a657d95e27e62dfde001f";
export const callbackSubtypeHostedArchiveFoundationImplementationPaths
	= Object.freeze([
		"scripts/archive-callback-subtype-evidence.mjs"
		, "scripts/check-callback-subtype-remaining-ci.mjs"
		, "tests/callback-subtype-hosted-archive.test.mjs"
		, "tests/callback-subtype-native-ci.test.mjs"
		, "tests/helpers/callback-subtype-hosted-archive.mjs"
		, "tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
		, "tests/helpers/callback-subtype-hosted-evidence.mjs"
		, "tests/helpers/callback-subtype-remaining-ci.mjs"
	]);
export const callbackSubtypeHostedArchiveFoundationModifiedPaths
	= Object.freeze([
		"scripts/check-callback-subtype-remaining-ci.mjs"
		, "tests/callback-subtype-native-ci.test.mjs"
	]);
export const callbackSubtypeHostedArchiveFoundationIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const callbackSubtypeHostedArchiveFoundationChangedPaths
	= Object.freeze([
		...callbackSubtypeHostedArchiveFoundationImplementationPaths
		, ...callbackSubtypeHostedArchiveFoundationIntegrationPaths
	]);
export const callbackSubtypeHostedArchiveFoundationAddedPaths
	= Object.freeze([
		"scripts/archive-callback-subtype-evidence.mjs"
		, "scripts/update-callback-subtype-hosted-archive-foundation-source-history.mjs"
		, "tests/callback-subtype-hosted-archive.test.mjs"
		, "tests/helpers/callback-subtype-hosted-archive-foundation-source-history-tests.mjs"
		, "tests/helpers/callback-subtype-hosted-archive-foundation-source-history.mjs"
		, "tests/helpers/callback-subtype-hosted-archive.mjs"
		, "tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
		, "tests/helpers/callback-subtype-hosted-evidence.mjs"
		, "tests/helpers/callback-subtype-remaining-ci.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeHostedArchiveFoundationHistoryPath, "utf8"));

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeHostedArchiveFoundationUpdate
	= (source, update) => {
		assert.ok(callbackSubtypeHostedArchiveFoundationChangedPaths
			.includes(update.path));
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
 * Remove only the exact hosted-archive foundation transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeHostedArchiveFoundationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeHostedArchiveFoundationChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackSubtypeHostedArchiveFoundationUpdate(source, update)
		: source;
};
