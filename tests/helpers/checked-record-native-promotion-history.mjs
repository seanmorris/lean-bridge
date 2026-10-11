/**
 * Authenticate Checked-record native support promotion without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeCheckedRecordHostCiSource } from "./checked-record-host-ci-history.mjs";

export const checkedRecordNativePromotionHistoryPath = "docs/evidence/checked-record-native-promotion-source-history-20261011.json";
export const checkedRecordNativePromotionPredecessor = "0ff897e7dbb27845238d4ad0dc3311e2f6dfe75e";
export const checkedRecordNativePromotionChangedPaths = [
	"docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
	, "tests/checked-records.test.mjs"
	, "tests/helpers/checked-record-remaining-hosts-history-tests.mjs"
	, "tests/helpers/checked-record-remaining-hosts-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCheckedRecordNativePromotionUpdate = (source, update) => {
	assert.ok(checkedRecordNativePromotionChangedPaths.includes(update.path));
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
 * Restore only authenticated predecessors, preserving requested stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCheckedRecordNativePromotionSource = (path, source, expected) => {
	source = beforeCheckedRecordHostCiSource(path, source, expected);
	if(typeof source !== "string" || !checkedRecordNativePromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordNativePromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordNativePromotionUpdate(source, update) : source;
};
