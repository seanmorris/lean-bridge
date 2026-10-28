/**
 * Authenticate the exact scoped npm and browser producer milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedNpmScopedProducerHistoryPath
	= "docs/evidence/owned-npm-scoped-producer-source-history-20261024.json";
export const ownedNpmScopedProducerPredecessor
	= "d3a9e0d2c87a2171f96812f48e0ed04a38e0511d";
export const ownedNpmScopedProducerImplementation
	= "06aae2741485e3a2f4e731f3823c60aa87eebeab";
export const ownedNpmScopedProducerIntegrationBase
	= "06aae2741485e3a2f4e731f3823c60aa87eebeab";
export const ownedNpmScopedProducerCommits = Object.freeze([
	"06aae2741485e3a2f4e731f3823c60aa87eebeab"
]);
export const ownedNpmScopedProducerChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/contributing/testing.md"
	, "tests/helpers/checked-record-value-index-hosted-archive.mjs"
	, "tests/helpers/owned-checked-record-hosted-evidence-sources.mjs"
	, "tests/helpers/owned-checked-record-hosted-evidence.mjs"
	, "tests/owned-checked-record-hosted-archive.test.mjs"
]);
export const ownedNpmScopedProducerImplementationAddedPaths = Object.freeze([
	".github/workflows/owned-checked-record-npm-browser.yml"
	, "tests/helpers/owned-checked-record-npm-producer.mjs"
	, "tests/helpers/owned-checked-record-npm-producer-tests.mjs"
]);
export const ownedNpmScopedProducerImplementationPaths = Object.freeze([
	...ownedNpmScopedProducerChangedPaths
	, ...ownedNpmScopedProducerImplementationAddedPaths
]);
export const ownedNpmScopedProducerIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedNpmScopedProducerNormalizationPaths = Object.freeze([
	...ownedNpmScopedProducerChangedPaths
	, ...ownedNpmScopedProducerIntegrationPaths
]);
export const ownedNpmScopedProducerHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-npm-scoped-producer-source-history.mjs"
	, "tests/helpers/owned-npm-scoped-producer-source-history-tests.mjs"
	, "tests/helpers/owned-npm-scoped-producer-source-history.mjs"
]);
export const ownedNpmScopedProducerAddedPaths = Object.freeze([
	...ownedNpmScopedProducerImplementationAddedPaths
	, ...ownedNpmScopedProducerHistoryAddedPaths
]);
export const ownedNpmScopedProducerPins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "dfdbc01a11b1c272e68e658cfbad28f14131244a23e0566a053f373954993a27"
		, currentSha256: "6c1a59dbc2731390baa936c5776b2418c29f78678e7b9f7633fc97252919e1b1"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedNpmScopedProducerHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedNpmScopedProducerUpdate = (
	source, update
) => {
	assert.ok(ownedNpmScopedProducerNormalizationPaths
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
 * Remove only the exact Owned npm scoped producer.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedNpmScopedProducerSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedNpmScopedProducerNormalizationPaths.includes(path))
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
		current = reverseOwnedNpmScopedProducerUpdate(current, update);
	}
	return current;
};
