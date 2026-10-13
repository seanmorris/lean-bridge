/**
 * Authenticate the nominal C# promotion without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNativeConsumerPartitionSource } from "./native-consumer-partition-history.mjs";

export const nominalSubtypeDotnetPromotionHistoryPath = "docs/evidence/nominal-subtype-dotnet-promotion-source-history-20261012.json";
export const nominalSubtypeDotnetPromotionPredecessor = "ad838834ca234ac7715462df368c28ca0d1cede1";
export const nominalSubtypeDotnetPromotionChangedPaths = [
	"docs/consume/dotnet.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/jvm-container-entry-exit-history-tests.mjs"
	, "tests/helpers/jvm-container-entry-exit-history.mjs"
	, "tests/helpers/nominal-subtype-author-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-tests.mjs"
	, "tests/helpers/nominal-subtype-native-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-native-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-python-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-python-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-python-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-promotion-tests.mjs"
	, "tests/helpers/php-wasm-failure-diagnostics-history-tests.mjs"
	, "tests/helpers/structural-subtype-promotion-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Restore a complete transition only when both file digests and every span match.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseNominalSubtypeDotnetPromotionUpdate = (source, update) => {
	assert.ok(nominalSubtypeDotnetPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Keep unknown edits and honor exact requested stopping points.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeNominalSubtypeDotnetPromotionSource = (path, source, expected) => {
	source = beforeNativeConsumerPartitionSource(path, source, expected);
	if(typeof source !== "string" || !nominalSubtypeDotnetPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeDotnetPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeDotnetPromotionUpdate(source, update) : source;
};
