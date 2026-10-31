/**
 * Preserve the history-aware consumer sparse-checkout closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerHistorySparseCheckoutClosureHistoryPath
	= "docs/evidence/consumer-history-sparse-checkout-closure-source-history-20261031.json";
export const consumerHistorySparseCheckoutClosurePredecessor
	= "384e44c25a9947019b15b8e21167ad66e80d777a";
export const consumerHistorySparseCheckoutClosureImplementation
	= "b00a191bee46e2f3cc0fdb1a1e25d137c92403e2";
export const consumerHistorySparseCheckoutClosurePinRepair
	= "d23faea35e47a6af5a0988d29e6e3a711bf385d9";
export const consumerHistorySparseCheckoutClosureImplementationPaths
	= Object.freeze([".github/workflows/consumer-matrix.yml"]);
export const consumerHistorySparseCheckoutClosurePinPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const consumerHistorySparseCheckoutClosureIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/consumer-type-surface-documentation-contract-repair-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const consumerHistorySparseCheckoutClosureAddedPaths = Object.freeze([
	"scripts/update-consumer-history-sparse-checkout-closure-source-history.mjs"
	, "tests/helpers/consumer-history-sparse-checkout-closure-source-history-tests.mjs"
	, "tests/helpers/consumer-history-sparse-checkout-closure-source-history.mjs"
]);
export const consumerHistorySparseCheckoutClosureNormalizationPaths
	= Object.freeze([
		...consumerHistorySparseCheckoutClosureImplementationPaths
		, ...consumerHistorySparseCheckoutClosurePinPaths
		, ...consumerHistorySparseCheckoutClosureIntegrationPaths
	]);
export const consumerHistorySparseCheckoutJobs = Object.freeze([
	"documentation", "owned-javascript-wasm", "node-consumers"
	, "owned-php-callback-results", "php-consumers", "php-wasm-consumers"
	, "php-wasm-corpus", "php-multi-profile", "native-c-family-values"
	, "native-consumers", "managed-consumers", "owned-jvm-values"
	, "wasi-consumer"
]);
export const consumerHistoryNewSparseCheckoutJobs = Object.freeze([
	"documentation", "owned-javascript-wasm", "owned-php-callback-results"
]);
export const consumerHistoryCheckoutJobCount = 36;

let history;
const record = () => history ??= JSON.parse(readFileSync(
	consumerHistorySparseCheckoutClosureHistoryPath, "utf8"));

/**
 * Extract top-level workflow jobs.
 *
 * @param workflow - Complete workflow source.
 */
export const consumerHistoryJobs = workflow => {
	const starts = [...workflow.matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)]
		.map(match => ({ id: match[1], index: match.index }));
	return new Map(starts.map((start, index) => [start.id
		, workflow.slice(start.index
			, starts[index + 1]?.index ?? workflow.length)]));
};

const exactHistorySparse = /fetch-depth: 0\n {10}filter: blob:none\n {10}persist-credentials: false\n {10}sparse-checkout: \$\{\{ env[.]LEAN_BRIDGE_(?:CONSUMER|DOCUMENTATION)_SPARSE_CHECKOUT \}\}\n {10}sparse-checkout-cone-mode: false/u;

/**
 * Assert that no Consumer Matrix checkout materializes the retained payload
 * corpus and every history-dependent job uses a blobless partial clone.
 *
 * @param workflow - Complete workflow source.
 */
export const assertConsumerHistorySparseCheckoutClosure = workflow => {
	const jobs = consumerHistoryJobs(workflow);
	const checkouts = [...jobs].filter(([, body]) =>
		body.includes("actions/checkout@v6"));
	assert.equal(checkouts.length, consumerHistoryCheckoutJobCount);
	assert.deepEqual(checkouts.filter(([, body]) =>
		!body.includes("sparse-checkout:")).map(([id]) => id), []);
	for(const [id, body] of checkouts)
	{
		assert.match(body, /sparse-checkout:/u, id);
		assert.match(body, /sparse-checkout-cone-mode: false/u, id);
	}
	const historyJobs = checkouts.filter(([, body]) =>
		body.includes("fetch-depth: 0"));
	assert.deepEqual(historyJobs.map(([id]) => id)
		, consumerHistorySparseCheckoutJobs);
	for(const [id, body] of historyJobs)
	{
		assert.match(body, exactHistorySparse, id);
		assert.equal(body.split("filter: blob:none").length - 1, 1, id);
		assert.equal(body.split("persist-credentials: false").length - 1
			, 1, id);
	}
	for(const id of consumerHistoryNewSparseCheckoutJobs)
	{
		const body = jobs.get(id);
		const cleanup
			= "Free hosted runner disk before history-aware sparse checkout";
		assert.equal(body.split(cleanup).length - 1, 1, id);
		assert.ok(body.indexOf(cleanup)
			< body.indexOf("actions/checkout@v6"), id);
	}
	const documentation = jobs.get("documentation");
	assert.match(documentation
		, /sparse-checkout: \$\{\{ env[.]LEAN_BRIDGE_DOCUMENTATION_SPARSE_CHECKOUT \}\}/u);
	for(const pattern of [
		"/docs/evidence/**/*.json", "/docs/evidence/**/*.md"
		, "/docs/evidence/**/*.xml"
	]) assert.ok(workflow.includes(pattern), pattern);
	for(const id of ["owned-javascript-wasm", "owned-php-callback-results"])
		assert.match(jobs.get(id)
			, /sparse-checkout: \$\{\{ env[.]LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT \}\}/u
			, id);
};

/**
 * Reverse one exact history-aware sparse-checkout transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseConsumerHistorySparseCheckoutClosureUpdate
	= (source, update) => {
		assert.ok(consumerHistorySparseCheckoutClosureNormalizationPaths
			.includes(update.path), update.path);
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
 * Remove only the history-aware sparse-checkout closure transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeConsumerHistorySparseCheckoutClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerHistorySparseCheckoutClosureNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [
		record().integrationUpdates, record().pinUpdates, record().updates
	]){
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerHistorySparseCheckoutClosureUpdate(
				current, update);
	}
	return current;
};
