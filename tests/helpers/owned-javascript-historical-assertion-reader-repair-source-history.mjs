/**
 * Preserve the owned JavaScript historical-assertion reader repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedJavaScriptHistoricalAssertionReaderRepairHistoryPath
	= "docs/evidence/owned-javascript-historical-assertion-reader-repair-source-history-20261106.json";
export const ownedJavaScriptHistoricalAssertionReaderRepairPredecessor
	= "b9a02c7691a1a89dad4157cb8613e0fa24e0c0ff";
export const ownedJavaScriptHistoricalAssertionReaderRepairImplementation
	= "456cbd56700e9ef9bbabf031905917b7e28e5502";
export const ownedJavaScriptHistoricalAssertionReaderRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/owned-javascript-checkout-contract-repair-source-history-tests.mjs"
		, "tests/helpers/owned-javascript-checkout-contract-repair-source-history.mjs"
	]);
export const ownedJavaScriptHistoricalAssertionReaderRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const ownedJavaScriptHistoricalAssertionReaderRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-owned-javascript-historical-assertion-reader-repair-source-history.mjs"
		, "tests/helpers/owned-javascript-historical-assertion-reader-repair-source-history-tests.mjs"
		, "tests/helpers/owned-javascript-historical-assertion-reader-repair-source-history.mjs"
	]);
export const ownedJavaScriptHistoricalAssertionReaderRepairBehavior
	= Object.freeze({
		historicalAssertionCommit:
			"d3c7456ee19f16a716ed09232835057ce8762148"
		, historicalAssertionReaders: 1, negativeHistoricalMutations: 1
		, changedSupportCells: 0, runtimeSemanticChanges: 0
	});

const historyUrl = new URL("../../"
	+ ownedJavaScriptHistoricalAssertionReaderRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const ownedJavaScriptHistoricalAssertionReaderRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: ownedJavaScriptHistoricalAssertionReaderRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...ownedJavaScriptHistoricalAssertionReaderRepairImplementationPaths
	, ...ownedJavaScriptHistoricalAssertionReaderRepairIntegrationPaths
].includes(path);

/**
 * Require the historical producer to use its accompanying assertion source.
 *
 * @param {Record<string, string>} sources - Implementation sources by path.
 */
export const assertOwnedJavaScriptHistoricalAssertionReaderRepair = sources => {
	for(const path of
		ownedJavaScriptHistoricalAssertionReaderRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const helper = sources[
		"tests/helpers/owned-javascript-checkout-contract-repair-source-history.mjs"];
	assert.match(helper, /let historicalAssertionSource;/u);
	assert.match(helper, /assertHistoricalOwnedJavaScriptWasmCi/u);
	assert.ok(helper.includes(
		"ownedJavaScriptCheckoutContractRepairImplementation}:tests/helpers/owned-javascript-wasm-ci.mjs"));
	assert.match(helper, /spawnSync\(process\.execPath/u);
	assert.doesNotMatch(helper
		, /import \{ assertOwnedJavaScriptWasmCi \}/u);
	assert.match(helper
		, /const recurringContract = assertHistoricalOwnedJavaScriptWasmCi\(recurring\)/u);
	const tests = sources[
		"tests/helpers/owned-javascript-checkout-contract-repair-source-history-tests.mjs"];
	assert.match(tests, /timeout-minutes: 89/u);
	assert.match(tests
		, /assert\.throws\(\(\) => assertOwnedJavaScriptCheckoutContractRepair/u);
	return { ...ownedJavaScriptHistoricalAssertionReaderRepairBehavior };
};

/**
 * Reverse one authenticated historical-reader transition.
 *
 * @param {string} source - Complete later source.
 * @param {{path:string,currentSha256:string,previousSha256:string,edits:Array}} update - Authenticated transition.
 */
export const reverseOwnedJavaScriptHistoricalAssertionReaderRepairUpdate = (
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
 * Remove only authenticated historical-assertion reader transitions.
 *
 * @param {string} path - Repository-relative path.
 * @param {string|Buffer} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforeOwnedJavaScriptHistoricalAssertionReaderRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedJavaScriptHistoricalAssertionReaderRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOwnedJavaScriptHistoricalAssertionReaderRepairUpdate(
				current, update);
	}
	return current;
};
