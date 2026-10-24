/** @file */
import assert from "node:assert/strict";
import test from "node:test";
import {
	phpWasmCallbackEntryCaller, phpWasmCallbackEntryExpected
	, phpWasmCallbackEntryRequest
} from "./php-wasm-callback-entry-fixtures.mjs";

test("callback probe callers bind only lexical strictness and expose one control function", async () => {
	for(const family of ["callback-fin", "callback-checked-record", "callback-subtype"])
	{
		const weak = await phpWasmCallbackEntryCaller(family, "weak");
		const strict = await phpWasmCallbackEntryCaller(family, "strict");
		assert.equal(weak.replace("declare(strict_types=0);", "declare(strict_types=1);"), strict);
		assert.equal((weak.match(/function lean_bridge_callback_probe\(/gu) ?? []).length, 1);
		assert.doesNotMatch(weak, /vendor\/autoload\.php/u);
	}
});

test("callback probe requests retain the complete independent plan", () => {
	const entryProbe = {
		scope: "separate-instrumented-probe"
		, family: "callback-fin"
		, selected: [{ symbol: "x", kind: "source", label: "Probe.x" }], cases: [] };
	const embedded = JSON.parse(phpWasmCallbackEntryRequest(
		"callback-fin", "embedded", entryProbe
	));
	const composer = JSON.parse(phpWasmCallbackEntryRequest(
		"callback-fin", "composer", entryProbe
	));
	assert.deepEqual(embedded.entryProbe, entryProbe);
	assert.match(embedded.autoload, /bootstrap\.php$/u);
	assert.equal(composer.autoload, "vendor/autoload.php");
	const subtype = JSON.parse(phpWasmCallbackEntryRequest(
		"callback-subtype", "embedded", { ...entryProbe, family: "callback-subtype" }
	));
	assert.equal(subtype.module, "LeanCallbacksubtypes");
	assert.deepEqual(subtype.operations, { probe: "call_host" });
	assert.equal(subtype.autoload, "vendor/lean-bridge-callbacksubtypes/wasm/bootstrap.php");
	assert.throws(() => phpWasmCallbackEntryRequest("callback-container", "embedded", entryProbe));
	assert.deepEqual(phpWasmCallbackEntryExpected([
		{ outcome: "accepted" }, { outcome: "refused" }, { outcome: "accepted" }
	]), { controls: 3, accepted: 2, refused: 1 });
});
