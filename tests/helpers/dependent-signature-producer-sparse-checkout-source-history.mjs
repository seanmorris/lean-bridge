/**
 * Preserve the dependent-signature producer sparse-checkout transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentSignatureProducerSparseCheckoutHistoryPath
	= "docs/evidence/dependent-signature-producer-sparse-checkout-source-history-20261029.json";
export const dependentSignatureProducerSparseCheckoutPredecessor
	= "35e2eaf33eb47b7bea9702f84da73da5100cfc22";
export const dependentSignatureProducerSparseCheckoutImplementation
	= "299213044da2936cab0a611474399b1a5e54d9c1";
export const dependentSignatureProducerSparseCheckoutImplementationPaths
	= Object.freeze([
		".github/workflows/dependent-checked-record-browser.yml"
		, ".github/workflows/dependent-checked-record-dotnet.yml"
		, ".github/workflows/dependent-checked-record-jvm.yml"
		, ".github/workflows/dependent-checked-record-native.yml"
		, ".github/workflows/dependent-checked-record-perl.yml"
		, ".github/workflows/dependent-checked-record-php-wasm.yml"
		, ".github/workflows/dependent-checked-record-php.yml"
		, ".github/workflows/dependent-checked-record-python.yml"
		, ".github/workflows/dependent-checked-record-ruby.yml"
		, ".github/workflows/dependent-checked-record-rust.yml"
		, ".github/workflows/dependent-checked-record-wit.yml"
		, "tests/helpers/dependent-checked-record-jvm-ci-workflow.mjs"
		, "tests/helpers/dependent-checked-record-wit-ci-workflow.mjs"
		, "tests/helpers/dependent-signature-complete-ci-tests.mjs"
	]);
export const dependentSignatureProducerSparseCheckoutIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/proof-erasure-core-lint-repair-source-history-tests.mjs"
	]);
export const dependentSignatureProducerSparseCheckoutHistoryAdditions
	= Object.freeze([
		"scripts/update-dependent-signature-producer-sparse-checkout-source-history.mjs"
		, "tests/helpers/dependent-signature-producer-sparse-checkout-source-history-tests.mjs"
		, "tests/helpers/dependent-signature-producer-sparse-checkout-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${dependentSignatureProducerSparseCheckoutHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const dependentSignatureProducerSparseCheckoutNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: dependentSignatureProducerSparseCheckoutImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	dependentSignatureProducerSparseCheckoutImplementationPaths.includes(path)
	|| dependentSignatureProducerSparseCheckoutIntegrationPaths.includes(path);

/**
 * Reverse one authenticated producer sparse-checkout transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseDependentSignatureProducerSparseCheckoutUpdate = (
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
 * Remove only the authenticated producer sparse-checkout transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentSignatureProducerSparseCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentSignatureProducerSparseCheckoutNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDependentSignatureProducerSparseCheckoutUpdate(
				current, update);
	}
	return current;
};
