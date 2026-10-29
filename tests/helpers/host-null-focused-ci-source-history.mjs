/**
 * Preserve the bounded HostNull producer and exact-run receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullFocusedCiHistoryPath
	= "docs/evidence/host-null-focused-ci-source-history-20261029.json";
export const hostNullFocusedCiPredecessor
	= "8edce1b910b314c8c37712aac4d8e9b63b04be3f";
export const hostNullFocusedCiImplementation
	= "65336239160d2c5a1836fece63b513c4022d925c";
export const hostNullFocusedCiImplementationPaths = Object.freeze([
	".github/workflows/generic-subtype-managed-wit.yml"
	, ".github/workflows/generic-subtype-native-perl.yml"
	, ".github/workflows/generic-subtype-npm-browser.yml"
	, ".github/workflows/host-null-complete.yml"
	, ".github/workflows/nominal-subtype-php-wasm.yml"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/generic-subtype-npm-browser-ci-tests.mjs"
	, "tests/helpers/host-null-complete-ci-tests.mjs"
]);
export const hostNullFocusedCiImplementationAdditions = Object.freeze([
	"scripts/reconcile-host-null-complete-matrix.mjs"
	, "tests/helpers/host-null-complete-matrix-receipt-tests.mjs"
	, "tests/helpers/host-null-complete-matrix-receipt.mjs"
]);
export const hostNullFocusedCiIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullFocusedCiHistoryAdditions = Object.freeze([
	"scripts/update-host-null-focused-ci-source-history.mjs"
	, "tests/helpers/host-null-focused-ci-source-history-tests.mjs"
	, "tests/helpers/host-null-focused-ci-source-history.mjs"
]);

const historyUrl = new URL(`../../${hostNullFocusedCiHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const hostNullFocusedCiNormalizationPaths = Object.freeze([
	...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: hostNullFocusedCiImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])
].sort());
const allowedPath = path => hostNullFocusedCiImplementationPaths.includes(path)
	|| hostNullFocusedCiIntegrationPaths.includes(path);

/**
 * Reverse one exact focused-CI source transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseHostNullFocusedCiUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), [
			"current", "previous", "start"
		]);
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
 * Remove focused HostNull integration and implementation transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeHostNullFocusedCiSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !hostNullFocusedCiNormalizationPaths.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHostNullFocusedCiUpdate(current, update);
	}
	return current;
};
