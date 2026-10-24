/**
 * Authenticate the endpoint-stop, omitted .NET transition and milestone-read
 * integration without rewriting original receipts or package observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHistoryEndpointIntegrationHistoryPath
	= "docs/evidence/core-history-endpoint-integration-source-history-20261024.json";
export const coreHistoryEndpointIntegrationPredecessor
	= "97e074ce3e216c88b4b0347c853bb59b6942a665";
export const coreHistoryEndpointIntegrationImplementation
	= "9d05f2247ebf52e926752d6468d96e70970be1e1";
export const coreHistoryEndpointIntegrationIntegrationBase
	= "9d05f2247ebf52e926752d6468d96e70970be1e1";
export const coreHistoryEndpointIntegrationCommits = Object.freeze([
	"a51c7fc6c3a517c04d834279f459efdd41206c44"
	, "be1d4c1d67ce5e05c0ae79521a8e2398f0669c5a"
	, "6f01745235ffeec78f2817af723bee085a002260"
	, "9d05f2247ebf52e926752d6468d96e70970be1e1"
]);
export const coreHistoryEndpointIntegrationParents = Object.freeze([
	Object.freeze(["97e074ce3e216c88b4b0347c853bb59b6942a665","900bc8d183ba9c65266ef239d1521be98a807cef"])
	, Object.freeze(["a51c7fc6c3a517c04d834279f459efdd41206c44"])
	, Object.freeze(["be1d4c1d67ce5e05c0ae79521a8e2398f0669c5a"])
	, Object.freeze(["6f01745235ffeec78f2817af723bee085a002260"])
]);
export const coreHistoryEndpointIntegrationRetainedCommits = Object.freeze([
	Object.freeze({ commit: "c49330cc8790a0c22a5b11cdf68da64a8933fd14"
		, parent: "473327396bae25615f116e6fa015cbbe73666ed5" })
	, Object.freeze({ commit: "900bc8d183ba9c65266ef239d1521be98a807cef"
		, parent: "c49330cc8790a0c22a5b11cdf68da64a8933fd14" })
]);
export const coreHistoryEndpointIntegrationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/inherited-checked-record-promotion-source-history-tests.mjs"
	, "tests/helpers/php-wasm-callback-result-acceptance-history.mjs"
	, "tests/helpers/primitive-audit-integration-source-history-tests.mjs"
	, "tests/helpers/primitive-audit-core-repair-source-history-tests.mjs"
]);
export const coreHistoryEndpointIntegrationImplementationAddedPaths = Object.freeze([
	"docs/evidence/php-wasm-callback-endpoint-stop-source-history-20261024.json"
	, "scripts/update-php-wasm-callback-endpoint-stop-source-history.mjs"
	, "tests/helpers/php-wasm-callback-endpoint-stop-source-history-tests.mjs"
	, "tests/helpers/php-wasm-callback-endpoint-stop-source-history.mjs"
	, "docs/evidence/zero-payload-dotnet-archive-gap-source-history-20261024.json"
	, "scripts/update-zero-payload-dotnet-archive-gap-source-history.mjs"
	, "tests/helpers/zero-payload-dotnet-archive-gap-source-history-tests.mjs"
	, "tests/helpers/zero-payload-dotnet-archive-gap-source-history.mjs"
]);
export const coreHistoryEndpointIntegrationImplementationPaths = Object.freeze([
	...coreHistoryEndpointIntegrationChangedPaths
	, ...coreHistoryEndpointIntegrationImplementationAddedPaths
]);
export const coreHistoryEndpointIntegrationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const coreHistoryEndpointIntegrationNormalizationPaths = Object.freeze([
	...coreHistoryEndpointIntegrationChangedPaths
	, ...coreHistoryEndpointIntegrationIntegrationPaths
]);
export const coreHistoryEndpointIntegrationHistoryAddedPaths = Object.freeze([
	"scripts/update-core-history-endpoint-integration-source-history.mjs"
	, "tests/helpers/core-history-endpoint-integration-source-history-tests.mjs"
	, "tests/helpers/core-history-endpoint-integration-source-history.mjs"
]);
export const coreHistoryEndpointIntegrationAddedPaths = Object.freeze([
	...coreHistoryEndpointIntegrationImplementationAddedPaths
	, ...coreHistoryEndpointIntegrationHistoryAddedPaths
]);
export const coreHistoryEndpointIntegrationPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/inherited-checked-record-promotion-source-history-tests.mjs"
		, count: 44
		, previousSha256: "0551d4db0a8845e4145af6f74337c53f54ef65ad8b2c6ece754b2c591701ff74"
		, currentSha256: "434d06429e17b39f2c1972de5e7aff1989a227e2c0abf99c88e86f8e265894db"
	})
]);


let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreHistoryEndpointIntegrationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreHistoryEndpointIntegrationUpdate = (
	source, update
) => {
	assert.ok(coreHistoryEndpointIntegrationNormalizationPaths
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
 * Remove only the exact Core history endpoint integration.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreHistoryEndpointIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreHistoryEndpointIntegrationNormalizationPaths.includes(path))
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
		current = reverseCoreHistoryEndpointIntegrationUpdate(current, update);
	}
	return current;
};
