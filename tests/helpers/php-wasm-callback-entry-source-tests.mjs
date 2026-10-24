/** @file */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	phpWasmCallbackEntryFamilies, phpWasmCallbackEntryHostedSelection
	, phpWasmCallbackEntrySourceFixture, restorePhpWasmCallbackEntrySource
} from "./php-wasm-callback-entry-source-fixtures.mjs";

test("callback source probes name source creation and authored closure bodies reversibly", async () => {
	for(const family of phpWasmCallbackEntryFamilies)
	{
		const fixture = await phpWasmCallbackEntrySourceFixture(family);
		const original = await readFile(fixture.path, "utf8");
		assert.equal(restorePhpWasmCallbackEntrySource(fixture), original);
		assert.notEqual(fixture.source, original);
		assert.ok(fixture.entries.some(item => item.kind === "source"));
		assert.ok(fixture.entries.some(item => item.kind === "closure"));
		assert.equal(new Set(fixture.entries.map(item => item.symbol)).size
			, fixture.entries.length);
		assert.deepEqual(Object.keys(fixture.entryForms).sort()
			, fixture.entries.map(item => item.symbol).sort());
		for(const item of fixture.entries)
		{
			assert.ok(["function", "global"].includes(
				fixture.entryForms[item.symbol]));
			if(item.kind === "closure")
				assert.equal(fixture.entryForms[item.symbol], "function");
			assert.match(fixture.source, new RegExp(`export ${item.symbol}`, "u"), item.symbol);
		}
	}
});

test("callback checked-record source keeps constructor, Subtype and mixed body identities distinct", async () => {
	const fixture = await phpWasmCallbackEntrySourceFixture("callback-checked-record");
	const constructors = fixture.entries.filter(item => item.kind === "constructor")
		.map(item => item.label);
	assert.deepEqual(constructors, [
		"CallbackCheckedRecords.mkInterval"
		, "CallbackCheckedRecords.checkedPositive"
		, "CallbackCheckedRecords.mkWeighted"
	]);
	assert.ok(fixture.entries.some(item => item.label
		=== "CallbackCheckedRecords.makeMixedClosure:body"));
	assert.match(fixture.source
		, /def makeMixedClosure \(_seed : Nat\).*:= makeMixedClosureProbeBody/u);
});

test("callback hosted selection is opt-in, closed and duplicate-free", () => {
	assert.deepEqual(phpWasmCallbackEntryHostedSelection({}), {
		enabled: false, families: [...phpWasmCallbackEntryFamilies]
		, routes: ["ordinary", "reviewed"]
	});
	assert.deepEqual(phpWasmCallbackEntryHostedSelection({
		LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_TEST: "1"
		, LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_FAMILIES: "callback-fin"
		, LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_ROUTES: "reviewed"
	}), { enabled: true, families: ["callback-fin"], routes: ["reviewed"] });
	assert.throws(() => phpWasmCallbackEntryHostedSelection({
		LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_TEST: "1"
		, LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_FAMILIES: "callback-fin,callback-fin"
	}));
	assert.throws(() => phpWasmCallbackEntryHostedSelection({
		LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_OUTPUT: "build/out"
	}));
});
