/**
 * Preserve the complete current-source pin refresh and aggregate preflight.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const completeCurrentSourcePinPreflightHistoryPath
	= "docs/evidence/complete-current-source-pin-preflight-source-history-20261106.json";
export const completeCurrentSourcePinPreflightPredecessor
	= "7f00af7e68528cfdbf073ec20b0747350f89a69d";
export const completeCurrentSourcePinPreflightPinRefresh
	= "92f2b7fde1326482788b544170b756f63030bf6e";
export const completeCurrentSourcePinPreflightImplementation
	= "dc43ede0673f858491519fc8fa2a0557be6013fe";
export const completeCurrentSourcePinPreflightCurrentSources = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, ".github/workflows/quality.yml"
	, "src/adoption/test-profiles.mjs"
	, "tests/generic-records.test.mjs"
]);
export const completeCurrentSourcePinPreflightImplementationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
	]);
export const completeCurrentSourcePinPreflightImplementationAdditions
	= Object.freeze([
		"scripts/preflight-current-source-pins.mjs"
		, "tests/helpers/current-source-pin-preflight-tests.mjs"
		, "tests/helpers/current-source-pin-preflight.mjs"
	]);
export const completeCurrentSourcePinPreflightIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/core-focused-source-pin-refresh-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const completeCurrentSourcePinPreflightHistoryAdditions = Object.freeze([
	"scripts/update-complete-current-source-pin-preflight-source-history.mjs"
	, "tests/helpers/complete-current-source-pin-preflight-source-history-tests.mjs"
	, "tests/helpers/complete-current-source-pin-preflight-source-history.mjs"
]);
export const completeCurrentSourcePinPreflightNormalizationPaths
	= Object.freeze([...new Set([
		...completeCurrentSourcePinPreflightImplementationPaths
		, ...completeCurrentSourcePinPreflightIntegrationPaths
	])].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	completeCurrentSourcePinPreflightHistoryPath, "utf8"));

/**
 * Reverse one authenticated transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseCompleteCurrentSourcePinPreflightUpdate = (
	source, update
) => {
	assert.ok(completeCurrentSourcePinPreflightNormalizationPaths
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
 * Remove the integration transition before the implementation transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeCompleteCurrentSourcePinPreflightSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !completeCurrentSourcePinPreflightNormalizationPaths.includes(path))
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
			current = reverseCompleteCurrentSourcePinPreflightUpdate(current, update);
	}
	return current;
};
