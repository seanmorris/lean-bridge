/**
 * Reverse the PHP-Wasm hosted entry verifier repository-root closure milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRefinementEntryHostedVerifierRootHistoryPath
	= "docs/evidence/php-wasm-refinement-entry-hosted-verifier-root-source-history-20261022.json";
export const phpWasmRefinementEntryHostedVerifierRootPredecessor
	= "c00b7668f98b167182dc0c7a229e95da4a4b8e6a";
export const phpWasmRefinementEntryHostedVerifierRootImplementation
	= "05b62b7a6d9a8bb8470b5d7edb58687684a21689";
export const phpWasmRefinementEntryHostedVerifierRootImplementationPaths
	= Object.freeze([
		"scripts/summarize-php-wasm-refinement-entry-hosted.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-summary-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-summary.mjs"
	]);
export const phpWasmRefinementEntryHostedVerifierRootIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const phpWasmRefinementEntryHostedVerifierRootChangedPaths
	= Object.freeze([
		...phpWasmRefinementEntryHostedVerifierRootImplementationPaths
		, ...phpWasmRefinementEntryHostedVerifierRootIntegrationPaths
	]);
export const phpWasmRefinementEntryHostedVerifierRootAddedPaths
	= Object.freeze([
		"scripts/update-php-wasm-refinement-entry-hosted-verifier-root-source-history.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-verifier-root-source-history-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-verifier-root-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRefinementEntryHostedVerifierRootHistoryPath, "utf8"));

/**
 * Restore one exact hosted-verifier source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmRefinementEntryHostedVerifierRootUpdate
	= (source, update) => {
		assert.ok(phpWasmRefinementEntryHostedVerifierRootChangedPaths
			.includes(update.path));
		assert.equal(sha256(source), update.currentSha256, update.path);
		assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
		let cursor = 0;
		const parts = [];
		for(const edit of update.edits)
		{
			assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
			assert.ok(Number.isSafeInteger(edit.start)
				&& edit.start >= cursor && edit.start <= source.length);
			assert.equal(typeof edit.previous, "string");
			assert.equal(typeof edit.current, "string");
			assert.notEqual(edit.previous, edit.current);
			assert.equal(source.slice(edit.start, edit.start + edit.current.length)
				, edit.current);
			parts.push(source.slice(cursor, edit.start), edit.previous);
			cursor = edit.start + edit.current.length;
		}
		parts.push(source.slice(cursor));
		const previous = parts.join("");
		assert.equal(sha256(previous), update.previousSha256, update.path);
		return previous;
	};

/**
 * Remove only the exact hosted-verifier closure milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmRefinementEntryHostedVerifierRootSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRefinementEntryHostedVerifierRootChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reversePhpWasmRefinementEntryHostedVerifierRootUpdate(source, update)
		: source;
};
