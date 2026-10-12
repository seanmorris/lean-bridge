/**
 * Authenticate the WIT workflow comparison repair without rewriting evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNominalSubtypeDotnetCiSource } from "./nominal-subtype-dotnet-ci-history.mjs";

export const witHistoryCheckoutRepairHistoryPath = "docs/evidence/wit-history-checkout-repair-source-history-20261012.json";
export const witHistoryCheckoutRepairPredecessor = "5762111059313672f23825b65df2f91ec05437a3";
export const witHistoryCheckoutRepairChangedPaths = [
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-dotnet-registration-history.mjs"
	, "tests/helpers/wit-history-checkout-history-tests.mjs"
];
let history;

/**
 * Reverse complete, digest-authenticated transitions only.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseWitHistoryCheckoutRepairUpdate = (source, update) => {
	assert.ok(witHistoryCheckoutRepairChangedPaths.includes(update.path));
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
export const beforeWitHistoryCheckoutRepairSource = (path, source, expected) => {
	source = beforeNominalSubtypeDotnetCiSource(path, source, expected);
	if(typeof source !== "string"
		|| !witHistoryCheckoutRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(witHistoryCheckoutRepairHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseWitHistoryCheckoutRepairUpdate(source, update) : source;
};
