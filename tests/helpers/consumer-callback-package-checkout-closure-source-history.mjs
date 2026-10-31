/**
 * Preserve the bounded checkout contract for all callback package jobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerCallbackPackageCheckoutClosureHistoryPath
	= "docs/evidence/consumer-callback-package-checkout-closure-source-history-20261031.json";
export const consumerCallbackPackageCheckoutClosurePredecessor
	= "1155a1e98a40f4adb29655909b2f1d5c828b1497";
export const consumerCallbackPackageCheckoutClosureImplementation
	= "205918622976be83af359795338a641bf3a1b387";
export const consumerCallbackPackageCheckoutClosurePinRepair
	= "0f62eb14fd373c6b2893c9915d00c8f65b716594";
export const consumerCallbackPackageCheckoutClosureImplementationPaths
	= Object.freeze([".github/workflows/consumer-matrix.yml"]);
export const consumerCallbackPackageCheckoutClosurePinPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const consumerCallbackPackageCheckoutClosureIntegrationPaths
	= Object.freeze([
		"tests/helpers/consumer-type-surface-documentation-contract-repair-source-history-tests.mjs"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const consumerCallbackPackageCheckoutClosureAddedPaths
	= Object.freeze([
		"scripts/update-consumer-callback-package-checkout-closure-source-history.mjs"
		, "tests/helpers/consumer-callback-package-checkout-closure-source-history-tests.mjs"
		, "tests/helpers/consumer-callback-package-checkout-closure-source-history.mjs"
	]);
export const consumerCallbackPackageCheckoutClosureNormalizationPaths
	= Object.freeze([
		...consumerCallbackPackageCheckoutClosureImplementationPaths
		, ...consumerCallbackPackageCheckoutClosurePinPaths
		, ...consumerCallbackPackageCheckoutClosureIntegrationPaths
	]);
export const consumerCallbackPackageCheckoutJobIds = Object.freeze([
	"owned-dotnet-callback-results", "owned-perl-callback-results"
	, "owned-jvm-callback-results", "owned-ruby-callback-results"
	, "owned-python-callback-results", "owned-rust-callback-results"
	, "owned-cpp-callback-results", "owned-callback-results"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	consumerCallbackPackageCheckoutClosureHistoryPath, "utf8"));

/**
 * Extract the top-level jobs from one workflow.
 *
 * @param workflow - Complete workflow source.
 */
export const consumerWorkflowJobs = workflow => {
	const starts = [...workflow.matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)]
		.map(match => ({ id: match[1], index: match.index }));
	return new Map(starts.map((start, index) => [start.id
		, workflow.slice(
			start.index, starts[index + 1]?.index ?? workflow.length)]));
};

/**
 * Require one bounded, non-cone sparse checkout after cleanup.
 *
 * @param id - Workflow job identifier.
 * @param job - Complete workflow job source.
 */
export const assertCallbackPackageCheckoutContract = (id, job) => {
	assert.ok(consumerCallbackPackageCheckoutJobIds.includes(id), id);
	const cleanup = "Free hosted runner disk before callback package builds";
	const checkout = "Check out the exact revision";
	assert.equal(job.split(cleanup).length - 1, 1, id);
	assert.equal(job.split(checkout).length - 1, 1, id);
	assert.ok(job.indexOf(cleanup) < job.indexOf(checkout), id);
	assert.match(job
		, /uses: actions\/checkout@v6\n {8}with:\n {10}fetch-depth: 1\n {10}persist-credentials: false\n {10}sparse-checkout: \$\{\{ env[.]LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT \}\}\n {10}sparse-checkout-cone-mode: false/u
		, id);
	assert.doesNotMatch(job, /fetch-depth: 0/u, id);
	assert.equal(job.split(
		"sparse-checkout: ${{ env.LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT }}"
	).length - 1, 1, id);
};

/**
 * Reverse one exact callback package checkout transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseConsumerCallbackPackageCheckoutClosureUpdate = (
	source, update
) => {
	assert.ok(consumerCallbackPackageCheckoutClosureNormalizationPaths
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
 * Remove only the callback package checkout closure transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeConsumerCallbackPackageCheckoutClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerCallbackPackageCheckoutClosureNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [
		record().integrationUpdates, record().pinUpdates, record().updates
	]){
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerCallbackPackageCheckoutClosureUpdate(
				current, update);
	}
	return current;
};
