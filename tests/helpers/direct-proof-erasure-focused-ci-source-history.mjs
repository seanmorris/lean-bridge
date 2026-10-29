/**
 * Preserve the bounded direct proof-erasure producer and exact-run receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureFocusedCiHistoryPath
	= "docs/evidence/direct-proof-erasure-focused-ci-source-history-20261029.json";
export const directProofErasureFocusedCiPredecessor
	= "faa88f5d030d8a377dcc30c8807d0d62b60533be";
export const directProofErasureFocusedCiImplementation
	= "0af32f5861db9f4d3621b2a69beef03b9352fcb5";
export const directProofErasureFocusedCiImplementationPaths = Object.freeze([
	".github/workflows/direct-proof-erasure-complete.yml"
	, ".github/workflows/generic-subtype-languages.yml"
	, ".github/workflows/generic-subtype-managed-wit.yml"
	, ".github/workflows/generic-subtype-native-perl.yml"
	, ".github/workflows/generic-subtype-npm-browser.yml"
	, ".github/workflows/nominal-subtype-php-wasm.yml"
	, ".github/workflows/optional-parameter-complete.yml"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/direct-proof-erasure-complete-ci-tests.mjs"
	, "tests/helpers/generic-subtype-npm-browser-ci-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow.mjs"
	, "tests/helpers/optional-parameter-matrix-receipt-tests.mjs"
]);
export const directProofErasureFocusedCiImplementationAdditions = Object.freeze([
	"scripts/reconcile-direct-proof-erasure-matrix.mjs"
	, "tests/helpers/direct-proof-erasure-matrix-receipt-tests.mjs"
	, "tests/helpers/direct-proof-erasure-matrix-receipt.mjs"
]);
export const directProofErasureFocusedCiIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-dispatch-bridge-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-focused-ci-source-history-tests.mjs"
]);
export const directProofErasureFocusedCiHistoryAdditions = Object.freeze([
	"scripts/update-direct-proof-erasure-focused-ci-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-focused-ci-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-focused-ci-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${directProofErasureFocusedCiHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	historyUrl, "utf8"
));
export const directProofErasureFocusedCiNormalizationPaths = Object.freeze([
	...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: directProofErasureFocusedCiImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])
].sort());
const allowedPath = path => directProofErasureFocusedCiImplementationPaths
	.includes(path) || directProofErasureFocusedCiIntegrationPaths.includes(path);

/**
 * Reverse one exact focused-CI source transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDirectProofErasureFocusedCiUpdate = (source, update) => {
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
 * Remove focused proof-erasure integration and implementation transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeDirectProofErasureFocusedCiSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureFocusedCiNormalizationPaths.includes(path))
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
			current = reverseDirectProofErasureFocusedCiUpdate(current, update);
	}
	return current;
};
