/**
 * Preserve exact source predecessors of the Checked-record promotion change (#1446).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeCopiedGraphRepairSource } from "./copied-graph-repair-source-history.mjs";

export const checkedRecordPromotionHistoryPath = "docs/evidence/checked-record-promotion-source-history-20261008.json";
export const checkedRecordPromotionChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/type-surface.mjs"
	, "docs/reference/types.md"
	, "docs/javascript-typescript.md"
	, "docs/php.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/ruby.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/rust.md"
	, "docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/wit-wasi.md"
	, "docs/evidence/refinement-closure-audit-20261007.md"
	, "tests/fin-python-ruby-evidence.test.mjs"
	, "tests/type-surface.test.mjs"
	, "tests/helpers/native-fin-promotion-tests.mjs"
	, "tests/helpers/reviewed-fin-promotion-tests.mjs"
	, "tests/helpers/reviewed-api-promotion-tests.mjs"
	, "tests/helpers/fin-python-ruby-promotion-tests.mjs"
	, "tests/helpers/fin-native-batch-promotion-tests.mjs"
	, "tests/helpers/php-shard-source-history.mjs"
	, "tests/helpers/php-shard-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCheckedRecordPromotionUpdate = (source, update) => {
	assert.ok(checkedRecordPromotionChangedPaths.includes(update.path));
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
 * Restore the source before #1220, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCheckedRecordPromotionSource = (path, source, expected) => {
	source = beforeCopiedGraphRepairSource(path, source, expected);
	if(typeof source !== "string" || !checkedRecordPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordPromotionUpdate(source, update) : source;
};
