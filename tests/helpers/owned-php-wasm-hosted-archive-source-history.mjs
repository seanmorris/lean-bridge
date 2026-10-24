/**
 * Reverse the exact owned PHP-Wasm hosted archive history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedPhpWasmHostedArchiveHistoryPath
	= "docs/evidence/owned-php-wasm-hosted-archive-source-history-20261024.json";
export const ownedPhpWasmHostedArchivePredecessor
	= "7bffd0771c915435d19978770a59e00b0cd32fa1";
export const ownedPhpWasmHostedArchiveImplementation
	= "f16c95bed5da9ad51baaf2c63a3ba8590cb1ee3d";
export const ownedPhpWasmHostedArchiveImplementationAddedPaths
	= Object.freeze([
		"tests/helpers/owned-checked-record-php-wasm-hosted-tests.mjs"
	]);
export const ownedPhpWasmHostedArchiveModifiedPaths = Object.freeze([
	"tests/helpers/owned-checked-record-hosted-contracts.mjs"
	, "tests/helpers/owned-checked-record-hosted-evidence-sources.mjs"
	, "tests/helpers/owned-checked-record-hosted-evidence.mjs"
	, "tests/helpers/owned-checked-record-hosted-output.mjs"
	, "tests/owned-checked-record-hosted-archive.test.mjs"
]);
export const ownedPhpWasmHostedArchiveImplementationPaths
	= Object.freeze([
		...ownedPhpWasmHostedArchiveModifiedPaths
		, ...ownedPhpWasmHostedArchiveImplementationAddedPaths
	]);
export const ownedPhpWasmHostedArchiveIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/checked-javascript.test.mjs"
	]);
export const ownedPhpWasmHostedArchiveNormalizationPaths
	= Object.freeze([
		...ownedPhpWasmHostedArchiveModifiedPaths
		, ...ownedPhpWasmHostedArchiveIntegrationPaths
	]);
export const ownedPhpWasmHostedArchiveAddedPaths = Object.freeze([
	...ownedPhpWasmHostedArchiveImplementationAddedPaths
	, "scripts/update-owned-php-wasm-hosted-archive-source-history.mjs"
	, "tests/helpers/owned-php-wasm-hosted-archive-source-history-tests.mjs"
	, "tests/helpers/owned-php-wasm-hosted-archive-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedPhpWasmHostedArchiveHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedPhpWasmHostedArchiveUpdate = (
	source, update
) => {
	assert.ok(ownedPhpWasmHostedArchiveNormalizationPaths
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
 * Remove only the exact owned PHP-Wasm hosted archive history.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedPhpWasmHostedArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedPhpWasmHostedArchiveNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedPhpWasmHostedArchiveUpdate(source, update)
		: source;
};
