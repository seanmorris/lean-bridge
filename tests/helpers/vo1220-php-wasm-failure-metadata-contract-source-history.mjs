/**
 * Preserve the PHP-Wasm failure-metadata contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220PhpWasmFailureMetadataContractHistoryPath
	= "docs/evidence/vo1220-php-wasm-failure-metadata-contract-source-history-20261113.json";
export const vo1220PhpWasmFailureMetadataContractPredecessor
	= "21fa588b683f2e2f57eb04e770ecbbd7573254e1";
export const vo1220PhpWasmFailureMetadataContractImplementation
	= "6a459c991ba5934b5439a96dc75560aa84af0e2b";
export const vo1220PhpWasmFailureMetadataContractImplementationPaths
	= Object.freeze([
		"tests/helpers/php-wasm-recursive-failure-evidence-tests.mjs"
	]);
export const vo1220PhpWasmFailureMetadataContractIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220PhpWasmFailureMetadataContractAddedPaths
	= Object.freeze([
		"scripts/update-vo1220-php-wasm-failure-metadata-contract-source-history.mjs"
		, "tests/helpers/vo1220-php-wasm-failure-metadata-contract-source-history-tests.mjs"
		, "tests/helpers/vo1220-php-wasm-failure-metadata-contract-source-history.mjs"
	]);
export const vo1220PhpWasmFailureMetadataContractNormalizationPaths
	= Object.freeze([
		...vo1220PhpWasmFailureMetadataContractImplementationPaths
		, ...vo1220PhpWasmFailureMetadataContractIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220PhpWasmFailureMetadataContractHistoryPath, "utf8"));

/**
 * Reverse one authenticated failure-metadata contract transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220PhpWasmFailureMetadataContractUpdate
	= (source, update) => {
		assert.ok(vo1220PhpWasmFailureMetadataContractNormalizationPaths
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
 * Remove only the authenticated failure-metadata contract repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220PhpWasmFailureMetadataContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220PhpWasmFailureMetadataContractNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected)
			return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220PhpWasmFailureMetadataContractUpdate(
				current, update);
	}
	return current;
};
