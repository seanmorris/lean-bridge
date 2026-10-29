/**
 * Preserve the dependent-signature audit sparse-checkout transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentSignatureAuditSparseCheckoutHistoryPath
	= "docs/evidence/dependent-signature-audit-sparse-checkout-source-history-20261029.json";
export const dependentSignatureAuditSparseCheckoutPredecessor
	= "1c64e3e673655634f8ee9505c0530a9ce922dcb4";
export const dependentSignatureAuditSparseCheckoutImplementation
	= "e33b182f5522d0e559fd27336d4b639bf3290c29";
export const dependentSignatureAuditSparseCheckoutImplementationPaths
	= Object.freeze([
		".github/workflows/dependent-signature-complete.yml"
		, "tests/helpers/dependent-signature-complete-ci-tests.mjs"
	]);
export const dependentSignatureAuditSparseCheckoutIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/optional-parameter-complete-promotion-source-history-tests.mjs"
	]);
export const dependentSignatureAuditSparseCheckoutHistoryAdditions
	= Object.freeze([
		"scripts/update-dependent-signature-audit-sparse-checkout-source-history.mjs"
		, "tests/helpers/dependent-signature-audit-sparse-checkout-source-history-tests.mjs"
		, "tests/helpers/dependent-signature-audit-sparse-checkout-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${dependentSignatureAuditSparseCheckoutHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const dependentSignatureAuditSparseCheckoutNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: dependentSignatureAuditSparseCheckoutImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	dependentSignatureAuditSparseCheckoutImplementationPaths.includes(path)
	|| dependentSignatureAuditSparseCheckoutIntegrationPaths.includes(path);

/**
 * Reverse one authenticated audit sparse-checkout transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseDependentSignatureAuditSparseCheckoutUpdate = (
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
 * Remove only the authenticated dependent-signature audit transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentSignatureAuditSparseCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentSignatureAuditSparseCheckoutNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDependentSignatureAuditSparseCheckoutUpdate(
				current, update);
	}
	return current;
};
