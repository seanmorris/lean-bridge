/**
 * Preserve the source-only dependent-signature receipt checkout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentSignatureReceiptSparseCheckoutHistoryPath
	= "docs/evidence/dependent-signature-receipt-sparse-checkout-source-history-20261029.json";
export const dependentSignatureReceiptSparseCheckoutPredecessor
	= "be5f1ca0ae2967ed42432c385abdda97578e29f1";
export const dependentSignatureReceiptSparseCheckoutImplementation
	= "45e754da628c9e440719c8f6d1674032accb8d3a";
export const dependentSignatureReceiptSparseCheckoutImplementationPaths
	= Object.freeze([
		".github/workflows/dependent-signature-complete.yml"
		, "tests/helpers/dependent-signature-complete-ci-tests.mjs"
	]);
export const dependentSignatureReceiptSparseCheckoutIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const dependentSignatureReceiptSparseCheckoutHistoryAdditions
	= Object.freeze([
		"scripts/update-dependent-signature-receipt-sparse-checkout-source-history.mjs"
		, "tests/helpers/dependent-signature-receipt-sparse-checkout-source-history-tests.mjs"
		, "tests/helpers/dependent-signature-receipt-sparse-checkout-source-history.mjs"
	]);
export const dependentSignatureReceiptSparseCheckoutNormalizationPaths
	= Object.freeze([...new Set([
		...dependentSignatureReceiptSparseCheckoutImplementationPaths
		, ...dependentSignatureReceiptSparseCheckoutIntegrationPaths
	])].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentSignatureReceiptSparseCheckoutHistoryPath, "utf8"
));

/**
 * Reverse one exact dependent receipt checkout transition.
 *
 * @param source - Complete current source.
 * @param update - Path, digests and current-side edits.
 */
export const reverseDependentSignatureReceiptSparseCheckoutUpdate = (
	source, update
) => {
	assert.ok(dependentSignatureReceiptSparseCheckoutNormalizationPaths
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
 * Remove the dependent receipt checkout layer newest-first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentSignatureReceiptSparseCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentSignatureReceiptSparseCheckoutNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDependentSignatureReceiptSparseCheckoutUpdate(
				current, update);
	}
	return current;
};
