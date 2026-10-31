/**
 * Preserve the complete consumer-matrix checkout disk closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerMatrixCheckoutClosureHistoryPath
	= "docs/evidence/consumer-matrix-checkout-closure-source-history-20261031.json";
export const consumerMatrixCheckoutClosurePredecessor
	= "cca467af06f599a26474c19d4dd2483e1361f3bb";
export const consumerMatrixCheckoutClosureImplementation
	= "3921871652be24f61867a17178c6d78cea67edd0";
export const consumerMatrixCheckoutClosurePinRepair
	= "3f3de81ed10b3c14e10df727908d4a61b3b4b0c3";
export const consumerMatrixCheckoutClosureImplementationPaths
	= Object.freeze([".github/workflows/consumer-matrix.yml"]);
export const consumerMatrixCheckoutClosurePinPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const consumerMatrixCheckoutClosureIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/consumer-type-surface-documentation-contract-repair-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const consumerMatrixCheckoutClosureAddedPaths = Object.freeze([
	"scripts/update-consumer-matrix-checkout-closure-source-history.mjs"
	, "tests/helpers/consumer-matrix-checkout-closure-source-history-tests.mjs"
	, "tests/helpers/consumer-matrix-checkout-closure-source-history.mjs"
]);
export const consumerMatrixCheckoutClosureNormalizationPaths = Object.freeze([
	...consumerMatrixCheckoutClosureImplementationPaths
	, ...consumerMatrixCheckoutClosurePinPaths
	, ...consumerMatrixCheckoutClosureIntegrationPaths
]);
export const consumerMatrixIntentionalCompleteCheckoutJobs = Object.freeze([
	"documentation", "owned-javascript-wasm", "owned-php-callback-results"
]);
export const consumerMatrixNewSparseCheckoutJobs = Object.freeze([
	"owned-javascript-receivers", "php-receivers"
	, "optional-parameter-matrix", "support-summary"
]);
export const consumerMatrixCheckoutJobCount = 36;

let history;
const record = () => history ??= JSON.parse(readFileSync(
	consumerMatrixCheckoutClosureHistoryPath, "utf8"));

/**
 * Extract top-level workflow jobs.
 *
 * @param workflow - Complete workflow source.
 */
export const consumerMatrixJobs = workflow => {
	const starts = [...workflow.matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)]
		.map(match => ({ id: match[1], index: match.index }));
	return new Map(starts.map((start, index) => [start.id
		, workflow.slice(start.index
			, starts[index + 1]?.index ?? workflow.length)]));
};

const exactSparse = /fetch-depth: 1\n {10}persist-credentials: false\n {10}sparse-checkout: \$\{\{ env[.]LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT \}\}\n {10}sparse-checkout-cone-mode: false/u;

/**
 * Assert the complete consumer checkout inventory and its two allowed shapes.
 *
 * @param workflow - Complete workflow source.
 */
export const assertConsumerMatrixCheckoutClosure = workflow => {
	const jobs = consumerMatrixJobs(workflow);
	const checkouts = [...jobs].filter(([, body]) =>
		body.includes("actions/checkout@v6"));
	assert.equal(checkouts.length, consumerMatrixCheckoutJobCount);
	const complete = checkouts.filter(([, body]) =>
		!body.includes("sparse-checkout:"));
	assert.deepEqual(complete.map(([id]) => id)
		, consumerMatrixIntentionalCompleteCheckoutJobs);
	for(const [id, body] of complete)
	{
		const cleanup = "Free hosted runner disk before complete history checkout";
		assert.equal(body.split(cleanup).length - 1, 1, id);
		assert.equal(body.split("fetch-depth: 0").length - 1, 1, id);
		assert.equal(body.split("persist-credentials: false").length - 1, 1
			, id);
		assert.ok(body.indexOf(cleanup)
			< body.indexOf("actions/checkout@v6"), id);
	}
	for(const [id, body] of checkouts)
		if(!consumerMatrixIntentionalCompleteCheckoutJobs.includes(id))
		{
			assert.match(body, /sparse-checkout:/u, id);
			assert.match(body, /sparse-checkout-cone-mode: false/u, id);
		}
	for(const id of consumerMatrixNewSparseCheckoutJobs)
	{
		const body = jobs.get(id);
		assert.match(body, exactSparse, id);
		assert.doesNotMatch(body, /fetch-depth: 0/u, id);
	}
	for(const id of ["owned-javascript-receivers", "php-receivers"])
	{
		const body = jobs.get(id);
		const cleanup = "Free hosted runner disk before receiver package builds";
		assert.equal(body.split(cleanup).length - 1, 1, id);
		assert.ok(body.indexOf(cleanup)
			< body.indexOf("actions/checkout@v6"), id);
	}
};

/**
 * Reverse one exact consumer checkout closure transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseConsumerMatrixCheckoutClosureUpdate = (source, update) => {
	assert.ok(consumerMatrixCheckoutClosureNormalizationPaths
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
 * Remove only the consumer checkout closure transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeConsumerMatrixCheckoutClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerMatrixCheckoutClosureNormalizationPaths.includes(path))
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
			current = reverseConsumerMatrixCheckoutClosureUpdate(current, update);
	}
	return current;
};
