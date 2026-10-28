/**
 * Preserve the exact nine Core milestone-read and checker repairs and their
 * central history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreReadSiteRepairHistoryPath
	= "docs/evidence/core-read-site-repair-source-history-20261028.json";
export const coreReadSiteRepairPredecessor
	= "ab4d3da99db338ccd597d3cafc54981e1d9a5727";
export const coreReadSiteRepairImplementation
	= "349bd47ba7780b17227b3da193ba3004e1b4f5a9";
export const coreReadSiteRepairCommits = Object.freeze([
	coreReadSiteRepairImplementation
]);
export const coreReadSiteRepairImplementationPaths = Object.freeze([
	"tests/helpers/callback-fin-coverage-tests.mjs"
	, "tests/helpers/callback-fin-coverage.mjs"
	, "tests/helpers/core-contract-evidence-tests.mjs"
	, "tests/helpers/nominal-subtype-entry-publication-source-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow.mjs"
	, "tests/owned-php-wasm-borrow-evidence.test.mjs"
	, "tests/owned-rust-borrow-evidence.test.mjs"
	, "tests/wasm-entry-supplement-history.test.mjs"
	, "tests/wit-owned-transfer-evidence.test.mjs"
]);
export const coreReadSiteRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreReadSiteRepairNormalizationPaths = Object.freeze([
	...coreReadSiteRepairImplementationPaths
	, ...coreReadSiteRepairIntegrationPaths
]);
export const coreReadSiteRepairAddedPaths = Object.freeze([
	"scripts/update-core-read-site-repair-source-history.mjs"
	, "tests/helpers/core-read-site-repair-source-history-tests.mjs"
	, "tests/helpers/core-read-site-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreReadSiteRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseCoreReadSiteRepairUpdate = (source, update) => {
	assert.ok(coreReadSiteRepairNormalizationPaths.includes(update.path));
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
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the recognized read-site repairs and their registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreReadSiteRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreReadSiteRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreReadSiteRepairUpdate(current, update);
	}
	return current;
};
