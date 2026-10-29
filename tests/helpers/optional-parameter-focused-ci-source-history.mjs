/**
 * Preserve the focused optional-parameter producer and receipt workflow.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterFocusedCiHistoryPath
	= "docs/evidence/optional-parameter-focused-ci-source-history-20261029.json";
export const optionalParameterFocusedCiPredecessor
	= "05cc74823170285e65cb75ad053bd623189f1a6d";
export const optionalParameterFocusedCiImplementation
	= "f2fdf5bfcd51ebebaf522bf2fc10f1051735ffbe";
export const optionalParameterFocusedCiImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/generic-subtype-languages.yml"
	, ".github/workflows/generic-subtype-managed-wit.yml"
	, ".github/workflows/generic-subtype-native-perl.yml"
	, ".github/workflows/generic-subtype-npm-browser.yml"
	, ".github/workflows/nominal-subtype-php-wasm.yml"
	, "scripts/reconcile-optional-parameter-matrix.mjs"
	, "tests/helpers/generic-subtype-npm-browser-ci-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow.mjs"
	, "tests/helpers/optional-parameter-matrix-receipt-tests.mjs"
	, "tests/helpers/optional-parameter-matrix-receipt.mjs"
	, "tests/helpers/optional-parameter-matrix.mjs"
	, "tests/workflow-trigger-policy.test.mjs"
]);
export const optionalParameterFocusedCiImplementationAdditions = Object.freeze([
	".github/workflows/optional-parameter-complete.yml"
]);
export const optionalParameterFocusedCiIntegrationPaths = Object.freeze([
	"config/checked-javascript.json"
	, "docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history-tests.mjs"
]);
export const optionalParameterFocusedCiHistoryAdditions = Object.freeze([
	"scripts/update-optional-parameter-focused-ci-source-history.mjs"
	, "tests/helpers/optional-parameter-focused-ci-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-focused-ci-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${optionalParameterFocusedCiHistoryPath}`, import.meta.url)
	, "utf8"
));

export const optionalParameterFocusedCiNormalizationPaths = Object.freeze([
	...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])
].sort());

const allowedPath = path => optionalParameterFocusedCiImplementationPaths
	.includes(path) || optionalParameterFocusedCiIntegrationPaths.includes(path);

/**
 * Reverse one exact focused-CI source transition.
 *
 * @param source - Complete later source.
 * @param update - Exact changed spans and endpoint identities.
 */
export const reverseOptionalParameterFocusedCiUpdate = (source, update) => {
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
 * Remove the authenticated registration and implementation transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical SHA-256.
 */
export const beforeOptionalParameterFocusedCiSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterFocusedCiNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected)
			return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOptionalParameterFocusedCiUpdate(current, update);
	}
	return current;
};
