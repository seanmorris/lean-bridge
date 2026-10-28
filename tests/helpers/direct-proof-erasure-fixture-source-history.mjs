/**
 * Preserve the exact direct proof-erasure package fixture and registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureFixtureHistoryPath
	= "docs/evidence/direct-proof-erasure-fixture-source-history-20261028.json";
export const directProofErasureFixturePredecessor
	= "19b96729b8360b8970dc2feb918a01a27049ff04";
export const directProofErasureFixtureImplementation
	= "bb0eb6bc52a12c8b76c1c5d0eb3c31e258af655d";
export const directProofErasureFixtureChangedPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
]);
export const directProofErasureFixtureIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const directProofErasureFixtureNormalizationPaths = Object.freeze([
	...directProofErasureFixtureChangedPaths
	, ...directProofErasureFixtureIntegrationPaths
]);
export const directProofErasureFixtureAddedPaths = Object.freeze([
	"tests/direct-proof-erasure.test.mjs"
	, "tests/fixtures/onboarding/direct-proof-erasure/DirectProofErasure.lean"
	, "tests/fixtures/onboarding/direct-proof-erasure/LICENSE"
	, "tests/fixtures/onboarding/direct-proof-erasure/lakefile.toml"
	, "tests/fixtures/onboarding/direct-proof-erasure/lean-toolchain"
	, "tests/fixtures/onboarding/direct-proof-erasure/package.json"
	, "tests/helpers/direct-proof-erasure-fixture.mjs"
	, "scripts/update-direct-proof-erasure-fixture-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-fixture-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-fixture-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureFixtureHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated package-fixture transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseDirectProofErasureFixtureUpdate = (source, update) => {
	assert.ok(directProofErasureFixtureNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove recognized package-fixture transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureFixtureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureFixtureNormalizationPaths.includes(path)) return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDirectProofErasureFixtureUpdate(current, update);
	}
	return current;
};
