/**
 * Authenticate the nominal Rust promotion without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypeDotnetRegistrationSource } from "./nominal-subtype-dotnet-registration-history.mjs";

export const nominalSubtypeRustPromotionHistoryPath = "docs/evidence/nominal-subtype-rust-promotion-source-history-20261012.json";
export const nominalSubtypeRustPromotionPredecessor = "d2d819205189ceaaf80d7e2cc80901111c778de2";
export const nominalSubtypeRustPromotionChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/rust.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-author-tests.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture-tests.mjs"
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
	, "tests/helpers/nominal-subtype-rust-archive-history-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-archive-history.mjs"
	, "tests/helpers/nominal-subtype-rust-registration-history-tests.mjs"
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
export const reverseNominalSubtypeRustPromotionUpdate = (source, update) => {
	assert.ok(nominalSubtypeRustPromotionChangedPaths.includes(update.path));
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
export const beforeNominalSubtypeRustPromotionSource = (path, source, expected) => {
	source = beforeNominalSubtypeDotnetRegistrationSource(path, source, expected);
	if(typeof source !== "string" || !nominalSubtypeRustPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeRustPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNominalSubtypeRustPromotionUpdate(source, update) : source;
};
