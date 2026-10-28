/**
 * Restore the omitted transfer-copy transition and preserve the historical
 * owned JavaScript/PHP-Wasm replay repair that exposed the gap.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedTransferCopyReplayRepairHistoryPath
	= "docs/evidence/owned-transfer-copy-replay-repair-source-history-20261023.json";
export const ownedTransferCopyReplayRepairPredecessor
	= "91516a2d4f6894d4b2537dd281b0a1d53309ec5c";
export const ownedTransferCopyReplayRepairImplementation
	= "6e5fb4c867be17d12c156619b4281e986a9f2642";
export const ownedTransferCopyHistoricalPredecessor
	= "8722c9ee9b25257ea132ed1be7310a833ede9893";
export const ownedTransferCopyHistoricalCommit
	= "06f7c43bc5fb87d2acd22dc866ba7d034bb148c8";
export const ownedTransferCopyNativeFollowupCommit
	= "308fc6a50dfb37e00e2f97f61c2a7d43efdb68c5";
export const ownedTransferCopyReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/owned-php-wasm-ci.mjs"
	, "tests/helpers/owned-php-wasm-package-evidence.mjs"
	, "tests/owned-javascript-wasm-evidence.test.mjs"
	, "tests/owned-php-wasm-evidence.test.mjs"
]);
export const ownedTransferCopyHistoricalPaths = Object.freeze([
	"src/backends/c/owned-values.mjs"
	, "src/backends/cpp/owned-callables.mjs"
	, "src/backends/cpp/owned-values.mjs"
	, "src/backends/python/owned-values.mjs"
	, "src/backends/rust/owned-values.mjs"
	, "src/build/owned-c-projection.mjs"
	, "src/release/owned-c-package.mjs"
	, "tests/owned-cpp-transfers.test.mjs"
	, "tests/owned-python-transfers.test.mjs"
	, "tests/owned-rust-transfers.test.mjs"
]);
export const ownedTransferCopyNativeFollowupPaths = Object.freeze([
	"src/build/owned-c-projection.mjs"
	, "src/release/owned-c-package.mjs"
]);
export const ownedReplayHistoricalGapGroups = Object.freeze([
	Object.freeze({
		currentCommit: "1b77979abe846c67f5b3b19693012ed0a238f8ea"
		, paths: Object.freeze([
			"src/backends/dotnet/owned-layout.mjs"
			, "src/backends/jvm/owned-layout.mjs"
			, "src/backends/php/owned-values.mjs"
			, "src/build/owned-dotnet-artifacts.mjs"
			, "src/build/owned-dotnet-projection.mjs"
			, "src/build/owned-jvm-artifacts.mjs"
			, "src/build/owned-jvm-projection.mjs"
			, "src/build/owned-php-artifacts.mjs"
			, "src/build/owned-php-projection.mjs"
		])
	})
	, Object.freeze({
		currentCommit: "18804049b371cfe17eaec867c0365fb4b47b8152"
		, paths: Object.freeze([
			"src/backends/perl/owned-package.mjs"
			, "src/backends/perl/owned-values.mjs"
			, "src/build/owned-perl-projection.mjs"
		])
	})
	, Object.freeze({
		currentCommit: "3c22d43fa73c646b9a2472e4b6aada674c0a564e"
		, paths: Object.freeze([
			"src/backends/ruby/owned-values.mjs"
			, "src/build/owned-ruby-artifacts.mjs"
			, "src/build/owned-ruby-projection.mjs"
		])
	})
	, Object.freeze({
		currentCommit: "cf5062772b63ee7483d0a30c2f9df3c01d358157"
		, paths: Object.freeze([
			"src/build/owned-python-artifacts.mjs"
			, "src/build/owned-rust-artifacts.mjs"
		])
	})
]);
export const ownedReplayHistoricalGapPaths = Object.freeze([
	...ownedReplayHistoricalGapGroups.flatMap(group => group.paths)
]);
export const ownedTransferCopyReplayRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/owned-aggregate-model.test.mjs"
]);
export const ownedTransferCopyReplayRepairNormalizationPaths = Object.freeze([
	...new Set([
		...ownedTransferCopyReplayRepairModifiedPaths
		, ...ownedTransferCopyHistoricalPaths
		, ...ownedReplayHistoricalGapPaths
		, ...ownedTransferCopyReplayRepairIntegrationPaths
	])
]);
export const ownedTransferCopyReplayRepairAddedPaths = Object.freeze([
	"scripts/update-owned-transfer-copy-replay-repair-source-history.mjs"
	, "tests/helpers/owned-transfer-copy-replay-repair-source-history-tests.mjs"
	, "tests/helpers/owned-transfer-copy-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedTransferCopyReplayRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseOwnedTransferCopyReplayRepairUpdate = (source, update) => {
	assert.ok(ownedTransferCopyReplayRepairNormalizationPaths.includes(
		update.path
	));
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
 * Remove one recognized repair or omitted historical transition. The central
 * hub owns stopping and re-entry so later recorded states can be unwound first.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeOwnedTransferCopyReplayRepairSource = (
	path, source, expected
) => {
	void expected;
	if(typeof source !== "string"
		|| !ownedTransferCopyReplayRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const digest = sha256(source);
	const update = [
		...value.integrationUpdates
		, ...value.updates
		, ...value.historicalTransitions
	].find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOwnedTransferCopyReplayRepairUpdate(source, update);
};
