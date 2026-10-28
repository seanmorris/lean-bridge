/**
 * Preserve the bounded signed-Nix checkout, native callback toolchain
 * resilience, and the exact live-pin repair that authenticates both changes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreCiReliabilityHistoryPath
	= "docs/evidence/core-ci-reliability-source-history-20261028.json";
export const coreCiReliabilityPredecessor
	= "89832ee525b229d494955fac1d04b4eaa6ca6fda";
export const coreCiReliabilityImplementationCommits = Object.freeze([
	"8b1c8b83f1ec4f4dc07f346176cc38f693beb34f"
	, "2f2ec1d395b6236cf0d6daf2567a565359fb30ce"
	, "0682fa53e094c9545fdea7548a813d960ba5e5fa"
]);
export const coreCiReliabilityImplementation
	= coreCiReliabilityImplementationCommits.at(-1);
export const coreCiReliabilityTransitions = Object.freeze([
	Object.freeze({
		previousCommit: coreCiReliabilityPredecessor
		, currentCommit: coreCiReliabilityImplementationCommits[0]
		, paths: Object.freeze([
			".github/workflows/consumer-matrix.yml"
		])
	})
	, Object.freeze({
		previousCommit: coreCiReliabilityImplementationCommits[0]
		, currentCommit: coreCiReliabilityImplementationCommits[1]
		, paths: Object.freeze([
			".github/workflows/callback-checked-record-languages.yml"
			, ".github/workflows/callback-checked-record-perl.yml"
			, "scripts/bootstrap-rust-ci.sh"
			, "scripts/bootstrap-toolchains.sh"
		])
	})
	, Object.freeze({
		previousCommit: coreCiReliabilityImplementationCommits[1]
		, currentCommit: coreCiReliabilityImplementationCommits[2]
		, paths: Object.freeze(["docs/type-surface.v1.json"])
	})
]);
export const coreCiReliabilityImplementationPaths = Object.freeze(
	coreCiReliabilityTransitions.flatMap(transition => transition.paths)
);
export const coreCiReliabilityIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreCiReliabilityNormalizationPaths = Object.freeze([
	...coreCiReliabilityImplementationPaths
	, ...coreCiReliabilityIntegrationPaths
]);
export const coreCiReliabilityAddedPaths = Object.freeze([
	"scripts/update-core-ci-reliability-source-history.mjs"
	, "tests/helpers/core-ci-reliability-source-history-tests.mjs"
	, "tests/helpers/core-ci-reliability-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreCiReliabilityHistoryPath, "utf8"
));

/**
 * Reverse one exact, non-overlapping source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreCiReliabilityUpdate = (source, update) => {
	assert.ok(coreCiReliabilityNormalizationPaths.includes(update.path));
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
 * Remove only the authenticated CI-reliability transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreCiReliabilitySource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !coreCiReliabilityNormalizationPaths.includes(path)) return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreCiReliabilityUpdate(current, update);
	}
	return current;
};
