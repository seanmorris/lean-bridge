/**
 * Preserve the exact proof erasure fixture lint repair, its type-surface pin refresh and its central history
 * registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const proofErasureLintPinRepairHistoryPath
	= "docs/evidence/proof-erasure-lint-pin-repair-source-history-20261028.json";
export const proofErasureLintPinRepairPredecessor
	= "b066c9f95e84808a384c51d5e53099154a70eea4";
export const proofErasureLintPinRepairImplementation
	= "49989ee275f7f6068bc7c2ebe4eaadb61a6cc825";
export const proofErasureLintPinRepairCommits = Object.freeze([
	proofErasureLintPinRepairImplementation
]);
export const proofErasureLintPinRepairTypeSurfacePath = "docs/type-surface.v1.json";
export const proofErasureLintPinRepairPinCount = 714;
export const proofErasureLintPinRepairPinnedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "schema/compiler-adapter-plan.schema.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-metadata.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-model.mjs"
	, "tests/elaborated-metadata.test.mjs"
]);
export const proofErasureLintPinRepairImplementationPaths = Object.freeze([
	proofErasureLintPinRepairTypeSurfacePath
	, "tests/fixtures/direct-proof-erasure-consumers/index.mts"
	, "tests/helpers/direct-proof-erasure-fixture.mjs"
]);
export const proofErasureLintPinRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const proofErasureLintPinRepairNormalizationPaths = Object.freeze([
	...proofErasureLintPinRepairImplementationPaths
	, ...proofErasureLintPinRepairIntegrationPaths
]);
export const proofErasureLintPinRepairAddedPaths = Object.freeze([
	"scripts/update-proof-erasure-lint-pin-repair-source-history.mjs"
	, "tests/helpers/proof-erasure-lint-pin-repair-source-history-tests.mjs"
	, "tests/helpers/proof-erasure-lint-pin-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	proofErasureLintPinRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and the current-side edits of one change.
 */
export const reverseProofErasureLintPinRepairUpdate = (source, update) => {
	assert.ok(proofErasureLintPinRepairNormalizationPaths.includes(update.path));
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
 * Remove only the recognized lint and pin repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeProofErasureLintPinRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !proofErasureLintPinRepairNormalizationPaths.includes(path))
		return source;
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
		current = reverseProofErasureLintPinRepairUpdate(current, update);
	}
	return current;
};
