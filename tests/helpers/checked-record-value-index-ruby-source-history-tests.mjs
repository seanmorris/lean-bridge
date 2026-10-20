/**
 * Exercise the Ruby value-index source-history reverser against its immutable
 * registration ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexRubySource, checkedRecordValueIndexRubyChangedPaths
	, checkedRecordValueIndexRubyHistoryPath, reverseCheckedRecordValueIndexRubyUpdate
} from "./checked-record-value-index-ruby-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

test("Ruby value-index source history reverses only its authenticated registration layer", async () => {
	const ledger = JSON.parse(await readFile(checkedRecordValueIndexRubyHistoryPath, "utf8"));
	assert.equal(ledger.schemaVersion, 1);
	assert.deepEqual(ledger.updates.map(update => update.path).sort(), [...checkedRecordValueIndexRubyChangedPaths].sort());
	for(const update of ledger.updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256);
		const previous = reverseCheckedRecordValueIndexRubyUpdate(current, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeCheckedRecordValueIndexRubySource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeCheckedRecordValueIndexRubySource(update.path, previous, update.previousSha256), previous);
	}
	assert.equal(beforeCheckedRecordValueIndexRubySource("missing", "text"), "text");
});
