/**
 * Reverse the authenticated synchronous callback checked-record rollout.
 *
 * The rollout intentionally spans multiple first-parent commits. Retaining
 * every transition lets evidence pinned to an intermediate revision normalize
 * to that exact source instead of treating the finished rollout as one diff.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordPromotionHistoryPath
	= "docs/evidence/callback-checked-record-promotion-source-history-20261022.json";
export const callbackCheckedRecordPromotionPredecessor
	= "250f73d8b2bed5380e7fb7c55b8f1f6ffd746e58";
export const callbackCheckedRecordPromotionImplementation
	= "a43e641185a166f1bdd682343f1c21ec7b053fcc";
export const callbackCheckedRecordPromotionCommits = Object.freeze([
	"7df3e8ce267c7148e31f39a3934ef0cb09347039"
	, "0cbdf03a3442e178d67f6c0a632c10c680eed77c"
	, "63672851d5be2ae25d2760840e824a7a9d622a8e"
	, "3bda5812c746e770967578603a1cbb83a60f1894"
	, "f731cad2a1c45f70244c40795137e0d7be08b712"
	, "37793d5bfb8a535022d2097786866d723ff15d6e"
	, "8dd50974f4f62d106dd54292d18044114be351db"
	, "9aebbf3bcabb3fdd9cd44dde20cfc55357fac11d"
	, "28d6c7a45a3e53d65167a04331e282ac0cd432a3"
	, "15caf1cc25ac6675941beaf709de5606543c5e15"
	, "e3dcc7c6c7bd8b5f15491585d78d07034225b279"
	, "9e7d8270c7ae87f18a05b3558dca7fce28b5b92d"
	, "74056c5191aa4e9bd4a2c4978708400f304f490d"
	, "446a2f0399e1449c689def3d90a3a936f75d0637"
	, "e3f5344dfe1341587c60a5867c1fa6bff97728b1"
	, "a15c8a4d5a35ebf9ef725ac48508c87c7ccef73b"
	, callbackCheckedRecordPromotionImplementation
]);
export const callbackCheckedRecordPromotionChangedPaths = Object.freeze([
	"docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/contributing/testing.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/type-surface.v1.json"
	, "scripts/archive-callback-checked-record-evidence.mjs"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-callback-checked-record-evidence.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/cpp/callable-graph-package.mjs"
	, "src/backends/javascript/copied-validators.mjs"
	, "tests/callback-checked-record-hosted-evidence.test.mjs"
	, "tests/callback-checked-record-native.test.mjs"
	, "tests/callback-checked-record-promotion.test.mjs"
	, "tests/checked-record-value-index-php-wasm-evidence.test.mjs"
	, "tests/contributing-docs.test.mjs"
	, "tests/fixtures/dependent-checked-record-browser/full.mts"
	, "tests/fixtures/dependent-checked-record-browser/result-only.mts"
	, "tests/helpers/callback-checked-record-hosted-evidence-sources.mjs"
	, "tests/helpers/callback-checked-record-hosted-evidence.mjs"
	, "tests/helpers/callback-checked-record-promotion.mjs"
	, "tests/helpers/dependent-checked-record-browser-tests.mjs"
	, "tests/helpers/dependent-checked-record-php-wasm-report.mjs"
]);
export const callbackCheckedRecordPromotionPredecessorPaths = Object.freeze(
	callbackCheckedRecordPromotionChangedPaths.filter(path => ![
		"scripts/archive-callback-checked-record-evidence.mjs"
		, "scripts/promote-callback-checked-record-evidence.mjs"
		, "tests/callback-checked-record-hosted-evidence.test.mjs"
		, "tests/callback-checked-record-promotion.test.mjs"
		, "tests/helpers/callback-checked-record-hosted-evidence-sources.mjs"
		, "tests/helpers/callback-checked-record-hosted-evidence.mjs"
		, "tests/helpers/callback-checked-record-promotion.mjs"
	].includes(path))
);
export const callbackCheckedRecordPromotionIntegrationPaths = Object.freeze([
	"docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/javascript-typescript.md"
	, "docs/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/callback-checked-record-promotion.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/type-surface-docs.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordPromotionHistoryPath, "utf8"
));
const paths = new Set([
	...callbackCheckedRecordPromotionChangedPaths
	, ...callbackCheckedRecordPromotionIntegrationPaths
]);

/**
 * Restore one complete transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - One exact first-parent or integration transition.
 */
export const reverseCallbackCheckedRecordPromotionUpdate = (
	source, update
) => {
	assert.ok(paths.has(update.path));
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
 * Remove every matching callback checked-record transition, newest first.
 * An expected digest stops normalization at an authenticated intermediate
 * commit, which is required by retained evidence produced during the rollout.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || !paths.has(path)) return source;
	const original = source;
	let current = source;
	const updates = [...record().updates, ...record().integrationUpdates];
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) break;
		current = reverseCallbackCheckedRecordPromotionUpdate(current, update);
	}
	return current === original ? source : current;
};
