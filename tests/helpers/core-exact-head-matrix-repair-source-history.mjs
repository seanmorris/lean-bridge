/**
 * Preserve the exact-head Core matrix residual repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreExactHeadMatrixRepairHistoryPath
	= "docs/evidence/core-exact-head-matrix-repair-source-history-20261027.json";
export const coreExactHeadMatrixRepairPredecessor
	= "69a2758fb51418920576d72f715975b94cec3d85";
export const coreExactHeadMatrixRepairImplementation
	= "b77841d9164cd0954ef145e768c6fc18e80e78e2";
export const coreExactHeadMatrixRepairImplementationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "scripts/core-contract-evidence.mjs"
	, "tests/helpers/callback-subtype-browser-ci-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-browser-ci-source-history.mjs"
	, "tests/helpers/core-contract-evidence-tests.mjs"
	, "tests/helpers/core-runner-resilience-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-specialization-closure.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-wit-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-entry-live-pin-repair-source-history-tests.mjs"
	, "tests/helpers/owned-dotnet-callback-result-acceptance.mjs"
	, "tests/helpers/owned-dotnet-callback-result-replay.mjs"
	, "tests/helpers/owned-jvm-callback-result-acceptance.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs"
	, "tests/helpers/owned-ruby-callback-result-acceptance.mjs"
	, "tests/helpers/owned-ruby-callback-result-evidence.mjs"
	, "tests/helpers/owned-rust-source-history.mjs"
	, "tests/helpers/producer-source.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-promotion-tests.mjs"
	, "tests/helpers/wit-owned-projection-history.mjs"
	, "tests/helpers/wit-owned-receiver-history.mjs"
	, "tests/owned-rust-evidence.test.mjs"
	, "tests/wit-owned-projection-evidence.test.mjs"
	, "tests/wit-owned-receiver-evidence.test.mjs"
]);
export const coreExactHeadMatrixRepairIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreExactHeadMatrixRepairNormalizationPaths = Object.freeze([
	...coreExactHeadMatrixRepairImplementationPaths
	, ...coreExactHeadMatrixRepairIntegrationPaths
]);
export const coreExactHeadMatrixRepairHistoryAdditions = Object.freeze([
	"scripts/update-core-exact-head-matrix-repair-source-history.mjs"
	, "tests/helpers/core-exact-head-matrix-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreExactHeadMatrixRepairHistoryPath, "utf8"
));

/**
 * Restore one exact, authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreExactHeadMatrixRepairUpdate = (source, update) => {
	assert.ok(coreExactHeadMatrixRepairNormalizationPaths.includes(update.path));
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
 * Remove only the authenticated exact-head matrix repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreExactHeadMatrixRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreExactHeadMatrixRepairNormalizationPaths.includes(path))
		return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreExactHeadMatrixRepairUpdate(current, update);
	}
	return current;
};
