/**
 * Authenticate the Perl and consumer-CI endpoint repair and unknown-source guard.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const corePerlConsumerEndpointRepairHistoryPath
	= "docs/evidence/core-perl-consumer-endpoint-repair-source-history-20261024.json";
export const corePerlConsumerEndpointRepairPredecessor
	= "7ca376011632ed899f232a19dc075f344efe3f20";
export const corePerlConsumerEndpointRepairImplementation
	= "71f5fc35815252ed08db8f53c0d9e318a3214632";
export const corePerlConsumerEndpointRepairIntegrationBase
	= "71f5fc35815252ed08db8f53c0d9e318a3214632";
export const corePerlConsumerEndpointRepairCommits = Object.freeze([
	"71f5fc35815252ed08db8f53c0d9e318a3214632"
]);
export const corePerlConsumerEndpointRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/perl-recursive-callable-evidence.mjs"
	, "tests/helpers/perl-structured-callable-evidence.mjs"
	, "tests/helpers/perl-structured-callable-source-history.mjs"
	, "tests/owned-consumer-ci-repair.test.mjs"
]);
export const corePerlConsumerEndpointRepairImplementationAddedPaths = Object.freeze([
	"tests/helpers/core-perl-consumer-endpoint-tests.mjs"
]);
export const corePerlConsumerEndpointRepairImplementationPaths = Object.freeze([
	...corePerlConsumerEndpointRepairChangedPaths
	, ...corePerlConsumerEndpointRepairImplementationAddedPaths
]);
export const corePerlConsumerEndpointRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const corePerlConsumerEndpointRepairNormalizationPaths = Object.freeze([
	...corePerlConsumerEndpointRepairChangedPaths
	, ...corePerlConsumerEndpointRepairIntegrationPaths
]);
export const corePerlConsumerEndpointRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-perl-consumer-endpoint-repair-source-history.mjs"
	, "tests/helpers/core-perl-consumer-endpoint-repair-source-history-tests.mjs"
	, "tests/helpers/core-perl-consumer-endpoint-repair-source-history.mjs"
]);
export const corePerlConsumerEndpointRepairAddedPaths = Object.freeze([
	...corePerlConsumerEndpointRepairImplementationAddedPaths
	, ...corePerlConsumerEndpointRepairHistoryAddedPaths
]);
export const corePerlConsumerEndpointRepairPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/perl-structured-callable-evidence.mjs"
		, count: 3
		, previousSha256: "ecfc0ead7c31fcd40d24dc1459db400e20a468057fe4ba23ecb540ab6f4ef7f4"
		, currentSha256: "e8066bfc6e8e3aba3112f4d59f97f348134f250e46d9680569bb58c8187d8564"
	})
	, Object.freeze({
		path: "tests/helpers/perl-recursive-callable-evidence.mjs"
		, count: 2
		, previousSha256: "fca48c951e38c9131660f258b6f0f975d29f4d6d4925014a1c154b0690a3bfac"
		, currentSha256: "6aa017c86214bb96221759b610a2846e633ec2c1dc85042f34abe315bf80d344"
	})
	, Object.freeze({
		path: "tests/helpers/perl-structured-callable-source-history.mjs"
		, count: 3
		, previousSha256: "4b4abc03cc99d3c26cf422c7bf62f81682fa427087ac60584e37b854e1d37cde"
		, currentSha256: "9ef8b0c68de653babed18ad25963c38406c85d701828e9a3992565ad13d26bc7"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	corePerlConsumerEndpointRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCorePerlConsumerEndpointRepairUpdate = (
	source, update
) => {
	assert.ok(corePerlConsumerEndpointRepairNormalizationPaths
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
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact Core Perl consumer endpoint repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCorePerlConsumerEndpointRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !corePerlConsumerEndpointRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCorePerlConsumerEndpointRepairUpdate(current, update);
	}
	return current;
};
