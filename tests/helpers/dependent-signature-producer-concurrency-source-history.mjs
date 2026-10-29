/**
 * Preserve the bounded dependent-signature producer graph transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentSignatureProducerConcurrencyHistoryPath
	= "docs/evidence/dependent-signature-producer-concurrency-source-history-20261029.json";
export const dependentSignatureProducerConcurrencyPredecessor
	= "84dbb45e8ecff4e2028ad1f8ce3cbb3231509ebf";
export const dependentSignatureProducerConcurrencyImplementation
	= "270c7202be12d692a498f92ff686643eef4af229";
export const dependentSignatureProducerConcurrencyImplementationPaths
	= Object.freeze([
		".github/workflows/dependent-signature-complete.yml"
		, "tests/helpers/dependent-signature-complete-ci-tests.mjs"
	]);
export const dependentSignatureProducerConcurrencyIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/dependent-signature-audit-sparse-checkout-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const dependentSignatureProducerConcurrencyHistoryAdditions
	= Object.freeze([
		"scripts/update-dependent-signature-producer-concurrency-source-history.mjs"
		, "tests/helpers/dependent-signature-producer-concurrency-source-history-tests.mjs"
		, "tests/helpers/dependent-signature-producer-concurrency-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${dependentSignatureProducerConcurrencyHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const dependentSignatureProducerConcurrencyNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: dependentSignatureProducerConcurrencyImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	dependentSignatureProducerConcurrencyImplementationPaths.includes(path)
	|| dependentSignatureProducerConcurrencyIntegrationPaths.includes(path);

/**
 * Reverse one authenticated producer-concurrency transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseDependentSignatureProducerConcurrencyUpdate = (
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
 * Remove only the authenticated producer-concurrency transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentSignatureProducerConcurrencySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentSignatureProducerConcurrencyNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDependentSignatureProducerConcurrencyUpdate(
				current, update);
	}
	return current;
};
