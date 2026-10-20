/**
 * Exercise the Rust value-index source-history reverser against its immutable
 * registration ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexRustSource, checkedRecordValueIndexRustChangedPaths
	, checkedRecordValueIndexRustHistoryPath, reverseCheckedRecordValueIndexRustUpdate
} from "./checked-record-value-index-rust-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

test("Rust value-index source history reverses only its authenticated registration layer", async () => {
	const ledger = JSON.parse(await readFile(checkedRecordValueIndexRustHistoryPath, "utf8"));
	assert.equal(ledger.schemaVersion, 1);
	assert.deepEqual(ledger.updates.map(update => update.path).sort(), [...checkedRecordValueIndexRustChangedPaths].sort());
	for(const update of ledger.updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256);
		const previous = reverseCheckedRecordValueIndexRustUpdate(current, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeCheckedRecordValueIndexRustSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeCheckedRecordValueIndexRustSource(update.path, previous, update.previousSha256), previous);
	}
	assert.equal(beforeCheckedRecordValueIndexRustSource("missing", "text"), "text");
});
