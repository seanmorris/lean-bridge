/**
 * Authenticate required nominal C# CI without rewriting previous evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalSubtypeDotnetCiHistoryPath = "docs/evidence/nominal-subtype-dotnet-ci-source-history-20261012.json";
export const nominalSubtypeDotnetCiPredecessor = "51f55c70d0aa7fc08e582e2de9fb51f12e1869f7";
export const nominalSubtypeDotnetCiChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-dotnet-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-promotion-history-tests.mjs"
	, "tests/helpers/wit-history-checkout-repair-history.mjs"
	, "tests/helpers/wit-history-checkout-repair-history-tests.mjs"
];
let history;

/**
 * Reverse complete, digest-authenticated transitions only.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseNominalSubtypeDotnetCiUpdate = (source, update) => {
	assert.ok(nominalSubtypeDotnetCiChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
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
 * Preserve unknown edits and stop at the explicitly requested source digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeNominalSubtypeDotnetCiSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nominalSubtypeDotnetCiChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nominalSubtypeDotnetCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseNominalSubtypeDotnetCiUpdate(source, update) : source;
};
