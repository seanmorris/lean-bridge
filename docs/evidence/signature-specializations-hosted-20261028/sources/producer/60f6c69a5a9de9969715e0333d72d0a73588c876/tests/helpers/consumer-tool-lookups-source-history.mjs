/**
 * Authenticate the consumer tool lookup cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerToolLookupsHistoryPath
	= "docs/evidence/consumer-tool-lookups-source-history-20261025.json";
export const consumerToolLookupsPredecessor
	= "8db80ea109610468c1e509037a6f1771371fa5cf";
export const consumerToolLookupsImplementation
	= "ece6091249f753db1e48a18648d6e6f9ff38ed47";
export const consumerToolLookupsIntegrationBase
	= "ece6091249f753db1e48a18648d6e6f9ff38ed47";
export const consumerToolLookupsCommits = Object.freeze([
	"ece6091249f753db1e48a18648d6e6f9ff38ed47"
]);
export const consumerToolLookupsChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "docs/type-surface.v1.json"
	, "tests/checked-javascript.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/owned-dotnet-callback-result-ci.mjs"
	, "tests/helpers/owned-jvm-callback-result-ci.mjs"
	, "tests/helpers/owned-jvm-receiver-ci.mjs"
	, "tests/helpers/owned-perl-callback-result-ci.mjs"
	, "tests/helpers/owned-php-receiver-ci.mjs"
	, "tests/helpers/owned-ruby-callback-result-ci.mjs"
]);
export const consumerToolLookupsImplementationAddedPaths = Object.freeze([
	"tests/helpers/consumer-tool-lookups.mjs"
	, "tests/helpers/consumer-tool-lookups-tests.mjs"
	, "docs/evidence/consumer-tool-lookups-20261025/acceptance.json"
	, "docs/evidence/consumer-tool-lookups-20261025/actionlint-after.log"
	, "docs/evidence/consumer-tool-lookups-20261025/actionlint-before.log"
	, "docs/evidence/consumer-tool-lookups-20261025/audit.mjs"
	, "docs/evidence/consumer-tool-lookups-20261025/run.tap"
]);
export const consumerToolLookupsImplementationPaths = Object.freeze([
	...consumerToolLookupsChangedPaths
	, ...consumerToolLookupsImplementationAddedPaths
]);
export const consumerToolLookupsIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const consumerToolLookupsNormalizationPaths = Object.freeze([
	...consumerToolLookupsChangedPaths
	, ...consumerToolLookupsIntegrationPaths
]);
export const consumerToolLookupsHistoryAddedPaths = Object.freeze([
	"scripts/update-consumer-tool-lookups-source-history.mjs"
	, "tests/helpers/consumer-tool-lookups-source-history-tests.mjs"
	, "tests/helpers/consumer-tool-lookups-source-history.mjs"
]);
export const consumerToolLookupsAddedPaths = Object.freeze([
	...consumerToolLookupsImplementationAddedPaths
	, ...consumerToolLookupsHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	consumerToolLookupsHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseConsumerToolLookupsUpdate = (
	source, update
) => {
	assert.ok(consumerToolLookupsNormalizationPaths
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
 * Remove only the exact consumer tool lookup cleanup.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeConsumerToolLookupsSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerToolLookupsNormalizationPaths.includes(path))
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
		current = reverseConsumerToolLookupsUpdate(current, update);
	}
	return current;
};
