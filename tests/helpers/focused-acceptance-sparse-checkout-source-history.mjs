/**
 * Preserve focused producer sparse checkouts without changing standalone jobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const focusedAcceptanceSparseCheckoutHistoryPath
	= "docs/evidence/focused-acceptance-sparse-checkout-source-history-20261029.json";
export const focusedAcceptanceSparseCheckoutPredecessor
	= "4c448dae17ac965e4e5f25d409b3dfaccca7d21e";
export const focusedAcceptanceSparseCheckoutImplementation
	= "49cd742e9b762dde79217a8492c46e63c50fd3a3";
export const focusedAcceptanceSparseCheckoutImplementationPaths = Object.freeze([
	".github/workflows/generic-subtype-languages.yml"
	, ".github/workflows/generic-subtype-managed-wit.yml"
	, ".github/workflows/generic-subtype-native-perl.yml"
	, ".github/workflows/generic-subtype-npm-browser.yml"
	, ".github/workflows/nominal-subtype-php-wasm.yml"
	, "tests/helpers/generic-subtype-npm-browser-ci-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow.mjs"
	, "tests/helpers/optional-parameter-matrix-receipt-tests.mjs"
]);
export const focusedAcceptanceSparseCheckoutIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/optional-parameter-receipt-sparse-checkout-source-history-tests.mjs"
]);
export const focusedAcceptanceSparseCheckoutHistoryAdditions = Object.freeze([
	"scripts/update-focused-acceptance-sparse-checkout-source-history.mjs"
	, "tests/helpers/focused-acceptance-sparse-checkout-source-history-tests.mjs"
	, "tests/helpers/focused-acceptance-sparse-checkout-source-history.mjs"
]);

const historyUrl = new URL(`../../${focusedAcceptanceSparseCheckoutHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const focusedAcceptanceSparseCheckoutNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: focusedAcceptanceSparseCheckoutImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => focusedAcceptanceSparseCheckoutImplementationPaths
	.includes(path) || focusedAcceptanceSparseCheckoutIntegrationPaths.includes(path);

/**
 * Reverse one authenticated focused sparse-checkout transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseFocusedAcceptanceSparseCheckoutUpdate = (source, update) => {
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
 * Remove only the authenticated focused sparse-checkout transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeFocusedAcceptanceSparseCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !focusedAcceptanceSparseCheckoutNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseFocusedAcceptanceSparseCheckoutUpdate(current, update);
	}
	return current;
};
