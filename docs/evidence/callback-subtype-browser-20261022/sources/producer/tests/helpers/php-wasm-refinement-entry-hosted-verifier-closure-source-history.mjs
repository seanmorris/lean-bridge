/**
 * Reverse the PHP-Wasm hosted entry verifier closure milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRefinementEntryHostedVerifierClosureHistoryPath
	= "docs/evidence/php-wasm-refinement-entry-hosted-verifier-closure-source-history-20261022.json";
export const phpWasmRefinementEntryHostedVerifierClosurePredecessor
	= "46df81614aefd5e6139808b54c5fc46b1ce30f77";
export const phpWasmRefinementEntryHostedVerifierClosureImplementation
	= "777ae32e448c936912f93fcbde5697c65fd5f31e";
export const phpWasmRefinementEntryHostedVerifierClosureImplementationPaths
	= Object.freeze([
		"scripts/summarize-php-wasm-refinement-entry-hosted.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-summary-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-summary.mjs"
	]);
export const phpWasmRefinementEntryHostedVerifierClosureIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const phpWasmRefinementEntryHostedVerifierClosureChangedPaths
	= Object.freeze([
		...phpWasmRefinementEntryHostedVerifierClosureImplementationPaths
		, ...phpWasmRefinementEntryHostedVerifierClosureIntegrationPaths
	]);
export const phpWasmRefinementEntryHostedVerifierClosureAddedPaths
	= Object.freeze([
		"scripts/update-php-wasm-refinement-entry-hosted-verifier-closure-source-history.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-verifier-closure-source-history-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-verifier-closure-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRefinementEntryHostedVerifierClosureHistoryPath, "utf8"));

/**
 * Restore one exact hosted-verifier source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmRefinementEntryHostedVerifierClosureUpdate
	= (source, update) => {
		assert.ok(phpWasmRefinementEntryHostedVerifierClosureChangedPaths
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
export const beforePhpWasmRefinementEntryHostedVerifierClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRefinementEntryHostedVerifierClosureChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reversePhpWasmRefinementEntryHostedVerifierClosureUpdate(source, update)
		: source;
};
