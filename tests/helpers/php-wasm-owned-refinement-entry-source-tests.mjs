/**
 * Authored-source controls for owned refinement dispatch probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	phpWasmOwnedRefinementEntryFamilies, phpWasmOwnedRefinementEntrySourceFixture
} from "./php-wasm-owned-refinement-entry-source-fixtures.mjs";

test("owned authored probes name every selected constructor and source reversibly", async () => {
	for(const family of phpWasmOwnedRefinementEntryFamilies)
	{
		const fixture = await phpWasmOwnedRefinementEntrySourceFixture(family);
		const original = await readFile(fixture.path, "utf8");
		assert.equal(fixture.originalSha256, sha256(original));
		assert.equal(fixture.probeSha256, sha256(fixture.source));
		assert.notEqual(fixture.source, original);
		assert.equal(new Set(fixture.entries.map(item => item.symbol)).size, fixture.entries.length);
		assert.equal(new Set(fixture.entries.map(item => `${item.kind}/${item.label}`)).size
			, fixture.entries.length);
		assert.ok(fixture.entries.some(item => item.kind === "constructor"));
		assert.ok(fixture.entries.some(item => item.kind === "source"));
		let restored = fixture.source;
		for(const edit of [...fixture.edits].reverse())
		{
			assert.equal(restored.slice(edit.offset, edit.offset + edit.current.length), edit.current);
			restored = restored.slice(0, edit.offset) + edit.previous
				+ restored.slice(edit.offset + edit.current.length);
		}
		assert.equal(restored, original);
	}
});

test("owned checked-record probe keeps copied, owned, nested and transfer choices distinct", async () => {
	const fixture = await phpWasmOwnedRefinementEntrySourceFixture("owned-checked-record");
	assert.deepEqual(fixture.entries.filter(item => item.kind === "constructor").map(item => item.label), [
		"OwnedCheckedRecords.mkWindow", "OwnedCheckedRecords.mkClaim"
		, "OwnedCheckedRecords.checkedPositive", "OwnedCheckedRecords.mkGrant"
	]);
	assert.deepEqual(fixture.entries.filter(item => item.kind === "source").map(item => item.label), [
		"OwnedCheckedRecords.newTicket", "OwnedCheckedRecords.echoBooking"
		, "OwnedCheckedRecords.echoClaim"
		, "OwnedCheckedRecords.transferClaim", "OwnedCheckedRecords.echoGrant"
		, "OwnedCheckedRecords.pairClaim"
	]);
});

test("owned Subtype probe retains alternate per-use constructor identity", async () => {
	const fixture = await phpWasmOwnedRefinementEntrySourceFixture("owned-subtype");
	assert.deepEqual(fixture.entries.filter(item => item.kind === "constructor").map(item => item.label), [
		"Owned.checkedCount", "Owned.checkedCountAlternate"
	]);
	assert.ok(fixture.source.includes("@[noinline, export lb_owned_entry_subtype_constructor_checkedCount]"));
	assert.ok(fixture.source.includes("@[noinline, export lb_owned_entry_subtype_constructor_checkedCountAlternate]"));
});
