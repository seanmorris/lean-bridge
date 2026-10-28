/**
 * Reverse the exact residual Core producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreResidualProducerReplayRepairHistoryPath
	= "docs/evidence/core-residual-producer-replay-repair-source-history-20261023.json";
export const coreResidualProducerReplayRepairPredecessor
	= "d0397e913fab755ce13843f098eddcd182a9b26e";
export const coreResidualProducerReplayRepairImplementation
	= "a7c64325cdfd42927b5cea4d51be4fd6240cf394";
export const coreResidualProducerReplayRepairImplementationAddedPaths
	= Object.freeze([
		"tests/helpers/producer-module.mjs"
	]);
export const coreResidualProducerReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/checked-record-perl-source-tests.mjs"
	, "tests/helpers/owned-jvm-borrow-evidence.mjs"
	, "tests/helpers/owned-wasm32-evidence.mjs"
]);
export const coreResidualProducerReplayRepairImplementationPaths
	= Object.freeze([
		...coreResidualProducerReplayRepairModifiedPaths
		, ...coreResidualProducerReplayRepairImplementationAddedPaths
	]);
export const coreResidualProducerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-jvm-borrow-evidence.test.mjs"
	]);
export const coreResidualProducerReplayRepairNormalizationPaths
	= Object.freeze([
		...coreResidualProducerReplayRepairModifiedPaths
		, ...coreResidualProducerReplayRepairIntegrationPaths
	]);
export const coreResidualProducerReplayRepairAddedPaths = Object.freeze([
	...coreResidualProducerReplayRepairImplementationAddedPaths
	, "scripts/update-core-residual-producer-replay-repair-source-history.mjs"
	, "tests/helpers/core-residual-producer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/core-residual-producer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreResidualProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCoreResidualProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(coreResidualProducerReplayRepairNormalizationPaths
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
 * Remove only the exact residual Core producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCoreResidualProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreResidualProducerReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCoreResidualProducerReplayRepairUpdate(source, update)
		: source;
};
