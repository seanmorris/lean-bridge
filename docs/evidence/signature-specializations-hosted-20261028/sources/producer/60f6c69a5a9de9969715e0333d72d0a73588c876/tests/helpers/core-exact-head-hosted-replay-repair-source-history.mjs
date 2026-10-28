/**
 * Preserve the exact-head hosted Core replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreExactHeadHostedReplayRepairHistoryPath
	= "docs/evidence/core-exact-head-hosted-replay-repair-source-history-20261027.json";
export const coreExactHeadHostedReplayRepairPredecessor
	= "cfb26c5210f49e142a40f73b16e5473d3aaad068";
export const coreExactHeadHostedReplayRepairImplementation
	= "12ce2b51e60d4c2dbbd6f5d2e1069345a46f5682";
export const coreExactHeadHostedReplayRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/callback-checked-record-hosted-evidence-sources.mjs"
		, "tests/helpers/callback-subtype-browser-ci-source-history-tests.mjs"
		, "tests/helpers/checked-record-native-host-history-tests.mjs"
		, "tests/helpers/checked-record-native-installed-history-tests.mjs"
		, "tests/helpers/checked-record-remaining-hosts-history-tests.mjs"
		, "tests/helpers/component-nominal-subtype-tests.mjs"
		, "tests/helpers/core-contract-evidence-tests.mjs"
		, "tests/helpers/core-perl-consumer-endpoint-tests.mjs"
		, "tests/helpers/core-recursive-endpoint-tests.mjs"
		, "tests/helpers/dependent-checked-record-promotion.mjs"
		, "tests/helpers/nominal-primitive-subtype-jvm-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-native-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-php-wasm-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-wit-promotion-tests.mjs"
		, "tests/helpers/owned-ruby-callback-result-acceptance.mjs"
		, "tests/helpers/owned-ruby-callback-result-package-evidence.mjs"
		, "tests/helpers/owned-subtype-promotion-catalog.mjs"
		, "tests/helpers/refinement-core-ci-history-tests.mjs"
		, "tests/helpers/source-at-fin-history-milestone.mjs"
		, "tests/helpers/type-surface-archive-pins.mjs"
		, "tests/owned-rust-evidence.test.mjs"
		, "tests/type-surface-docs.test.mjs"
		, "tests/wasm-entry-supplement-history.test.mjs"
		, "tests/wit-owned-projection-evidence.test.mjs"
		, "tests/wit-owned-receiver-evidence.test.mjs"
	]);
export const coreExactHeadHostedReplayRepairImplementationAdditions
	= Object.freeze([
		"tests/helpers/type-surface-historical-evidence.mjs"
	]);
export const coreExactHeadHostedReplayRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreExactHeadHostedReplayRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-core-exact-head-hosted-replay-repair-source-history.mjs"
		, "tests/helpers/core-exact-head-hosted-replay-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${coreExactHeadHostedReplayRepairHistoryPath}`
		, import.meta.url), "utf8"
));

/** List every reversible source in this transition. */
export const coreExactHeadHostedReplayRepairNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	coreExactHeadHostedReplayRepairImplementationPaths.includes(path)
	|| coreExactHeadHostedReplayRepairIntegrationPaths.includes(path);

/**
 * Restore one authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreExactHeadHostedReplayRepairUpdate = (
	source, update
) => {
	assert.ok(allowedTransitionPath(update.path), update.path);
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
 * Remove only the authenticated hosted-replay repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreExactHeadHostedReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	if(!updates.some(update => update.path === path)) return source;
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreExactHeadHostedReplayRepairUpdate(current, update);
	}
	return current;
};
