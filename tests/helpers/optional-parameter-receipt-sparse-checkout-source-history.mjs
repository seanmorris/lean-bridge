/**
 * Preserve the optional-parameter receipt sparse-checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterReceiptSparseCheckoutHistoryPath
	= "docs/evidence/optional-parameter-receipt-sparse-checkout-source-history-20261029.json";
export const optionalParameterReceiptSparseCheckoutPredecessor
	= "6701ca73f32cb1c67974fdae79e95b44281d758b";
export const optionalParameterReceiptSparseCheckoutImplementation
	= "6e903f1656b58494e171ccef0586e5fd8ff06b91";
export const optionalParameterReceiptSparseCheckoutImplementationPaths
	= Object.freeze([
		".github/workflows/optional-parameter-complete.yml"
		, "tests/helpers/optional-parameter-matrix-receipt-tests.mjs"
	]);
export const optionalParameterReceiptSparseCheckoutIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/optional-parameter-matrix-receipt-tests.mjs"
	]);
export const optionalParameterReceiptSparseCheckoutHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-receipt-sparse-checkout-source-history.mjs"
		, "tests/helpers/optional-parameter-receipt-sparse-checkout-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-receipt-sparse-checkout-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterReceiptSparseCheckoutHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterReceiptSparseCheckoutNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: optionalParameterReceiptSparseCheckoutImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	optionalParameterReceiptSparseCheckoutImplementationPaths.includes(path)
	|| optionalParameterReceiptSparseCheckoutIntegrationPaths.includes(path);

/**
 * Reverse one exact receipt-checkout transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterReceiptSparseCheckoutUpdate = (
	source, update
) => {
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
 * Remove the authenticated sparse-checkout repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalParameterReceiptSparseCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterReceiptSparseCheckoutNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOptionalParameterReceiptSparseCheckoutUpdate(
				current, update);
	}
	return current;
};
