/**
 * Preserve the bounded current-source checkouts used by the reviewed-IR gate
 * and the PHP-Wasm observation reporter.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const downstreamReporterSparseCheckoutHistoryPath
	= "docs/evidence/downstream-reporter-sparse-checkout-source-history-20261028.json";
export const downstreamReporterSparseCheckoutPredecessor
	= "aff0b8509fc16c8842e9129f88b74a21a79ff71f";
export const downstreamReporterSparseCheckoutImplementation
	= "50a8391fed57b6f62896146b499a49c7bd544a9e";
export const downstreamReporterSparseCheckoutPinRepair
	= "a69ef0b49d540a2f12f4cf4d3798b0ff18b02477";
export const downstreamReporterSparseCheckoutImplementationPaths
	= Object.freeze([
		".github/workflows/consumer-matrix.yml"
		, "tests/documentation.test.mjs"
	]);
export const downstreamReporterSparseCheckoutPinPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const downstreamReporterSparseCheckoutIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const downstreamReporterSparseCheckoutAddedPaths = Object.freeze([
	"scripts/update-downstream-reporter-sparse-checkout-source-history.mjs"
	, "tests/helpers/downstream-reporter-sparse-checkout-source-history-tests.mjs"
	, "tests/helpers/downstream-reporter-sparse-checkout-source-history.mjs"
]);
export const downstreamReporterSparseCheckoutNormalizationPaths
	= Object.freeze([
		...downstreamReporterSparseCheckoutImplementationPaths
		, ...downstreamReporterSparseCheckoutPinPaths
		, ...downstreamReporterSparseCheckoutIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	downstreamReporterSparseCheckoutHistoryPath, "utf8"
));

/**
 * Reverse one exact checkout-budget transition.
 *
 * @param source - Complete current source.
 * @param update - Exact current/predecessor transition.
 */
export const reverseDownstreamReporterSparseCheckoutUpdate
	= (source, update) => {
		assert.ok(downstreamReporterSparseCheckoutNormalizationPaths
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
 * Remove recognized checkout-budget transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDownstreamReporterSparseCheckoutSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !downstreamReporterSparseCheckoutNormalizationPaths.includes(path))
			return source;
		const value = record();
		const updates = [
			...value.integrationUpdates, ...value.pinUpdates, ...value.updates
		];
		let current = source;
		for(let count = 0; count < updates.length; ++count)
		{
			const digest = sha256(current);
			if(digest === expected) return current;
			const update = updates.find(item =>
				item.path === path && item.currentSha256 === digest);
			if(update === undefined) return current;
			current = reverseDownstreamReporterSparseCheckoutUpdate(
				current, update);
		}
		return current;
	};
