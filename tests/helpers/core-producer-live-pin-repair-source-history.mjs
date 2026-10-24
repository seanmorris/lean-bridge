/**
 * Reverse the explicit Core producer live-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreProducerLivePinRepairHistoryPath
	= "docs/evidence/core-producer-live-pin-repair-source-history-20261024.json";
export const coreProducerLivePinRepairPredecessor
	= "2014af9bf78714f0d5a5c0eb9a5ce724d7a1778e";
export const coreProducerLivePinRepairImplementation
	= "d47297259df32a557cc05c6c4c4dd72da5723309";
export const coreProducerLivePinRepairIntegrationBase
	= "d47297259df32a557cc05c6c4c4dd72da5723309";
export const coreProducerLivePinRepairCommits = Object.freeze([
	"d47297259df32a557cc05c6c4c4dd72da5723309"
]);
export const coreProducerLivePinRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const coreProducerLivePinRepairImplementationAddedPaths = Object.freeze([]);
export const coreProducerLivePinRepairImplementationPaths = Object.freeze([
	...coreProducerLivePinRepairChangedPaths
	, ...coreProducerLivePinRepairImplementationAddedPaths
]);
export const coreProducerLivePinRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const coreProducerLivePinRepairNormalizationPaths = Object.freeze([
	...coreProducerLivePinRepairChangedPaths
	, ...coreProducerLivePinRepairIntegrationPaths
]);
export const coreProducerLivePinRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-core-producer-live-pin-repair-source-history.mjs"
	, "tests/helpers/core-producer-live-pin-repair-source-history-tests.mjs"
	, "tests/helpers/core-producer-live-pin-repair-source-history.mjs"
]);
export const coreProducerLivePinRepairAddedPaths = Object.freeze([
	...coreProducerLivePinRepairImplementationAddedPaths
	, ...coreProducerLivePinRepairHistoryAddedPaths
]);

export const coreProducerLivePinRepairPins = Object.freeze([
	Object.freeze({
		path: "tests/component-structured-callable-evidence.test.mjs", count: 3
		, previousSha256: "75e290cb1e4d4753cb63d0143d573958bf4ffdccde9ac48b09141d916bb80c5e"
		, currentSha256: "e57efcc3815f511e8a07ca1cffc2ef4169585bd34734c9a6785fe9ae0107f172"
	})
	, Object.freeze({
		path: "tests/dotnet-recursive-callable-evidence.test.mjs", count: 2
		, previousSha256: "54fe434a560013528d25ca61c6d35806b50667e6c4e9a935cf7a2a95a189e495"
		, currentSha256: "a5432e0b6fe3a5bb9471bca3d9e05e9cf7af45e173939786d805d05c0c6d395a"
	})
	, Object.freeze({
		path: "tests/helpers/dotnet-recursive-callable-evidence.mjs", count: 2
		, previousSha256: "8b1706f88991634cf9a88c1e5222805a9066e6505f4381fdcd9f71b8347359f7"
		, currentSha256: "9a760536b0d599d2cb686edccd35989072b6ee5e7b5581c205ce8b3b6291a9c2"
	})
	, Object.freeze({
		path: "tests/helpers/npm-structured-callable-evidence.mjs", count: 3
		, previousSha256: "acc5277b49f1704885384293fb452b1614e4e055ddedf580f7d4ffcef468a7ff"
		, currentSha256: "2c36d8a24a6a99c7448a70344d6491919fb61a233137ee48471b5bfe9b8608aa"
	})
	, Object.freeze({
		path: "tests/helpers/wit-structured-callable-evidence.mjs", count: 7
		, previousSha256: "866a2f793fa673dbe1ecb5c104a6e0bc17db8696c0070f8a83211e354e58d90d"
		, currentSha256: "234a0d67693a9d7788513222ab7427ae1321f20cee68fca96bcab150ad23d55d"
	})
	, Object.freeze({
		path: "tests/java-collection-evidence.test.mjs", count: 4
		, previousSha256: "0976200f46566efae3f422861c7ca90a1e02d593bedf3f9c30dc467ec2ece71d"
		, currentSha256: "22ce4dd94ab4617eeceb59c723837a37529dad91ff4be43c874af5d6f4829429"
	})
	, Object.freeze({
		path: "tests/kotlin-collection-evidence.test.mjs", count: 10
		, previousSha256: "adebf2cc34a5dae976e8022b02e21cb1ea2e9ea2e3cf260c97ca6523b2de62e0"
		, currentSha256: "0e2d94303484aae879d96fbf3c498f8d1683c1616b1acf215e10f813e765637a"
	})
	, Object.freeze({
		path: "tests/ruby-structured-callable-evidence.test.mjs", count: 4
		, previousSha256: "47b94cee79cb38217f583932f406bb1ad22e7b0782122eb5127a77783f374897"
		, currentSha256: "3a1d2a7d73e8e526d6e748bf8b8bc64a1f6bb30ae83e9d75b9b4b4ad1e1e6b35"
	})
	, Object.freeze({
		path: "tests/wit-structured-callable-evidence.test.mjs", count: 7
		, previousSha256: "de01bf98b10acd4f4fbeefc99e7bf66746d97303881e3ed791de6b7a88bd6820"
		, currentSha256: "9737727d328986af5bfd6dc2ec8e770af1f7908b2adc4cd70b69417c9b4049f7"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreProducerLivePinRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreProducerLivePinRepairUpdate = (
	source, update
) => {
	assert.ok(coreProducerLivePinRepairNormalizationPaths
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
 * Remove only the exact Core producer live-pin repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreProducerLivePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreProducerLivePinRepairNormalizationPaths.includes(path))
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
		current = reverseCoreProducerLivePinRepairUpdate(current, update);
	}
	return current;
};
