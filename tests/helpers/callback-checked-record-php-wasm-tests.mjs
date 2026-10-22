/**
 * Fast contract controls for PHP-Wasm checked-record callbacks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	callbackCheckedRecordPhpWasmCaller, callbackCheckedRecordPhpWasmConfiguration
	, callbackCheckedRecordPhpWasmExpected, callbackCheckedRecordPhpWasmRequest
} from "./callback-checked-record-php-wasm-fixture.mjs";

test("PHP-Wasm checked-record callbacks preserve constructor selections", () => {
	const ordinary = callbackCheckedRecordPhpWasmConfiguration("ordinary");
	const reviewed = callbackCheckedRecordPhpWasmConfiguration("reviewed");
	assert.equal(Object.keys(ordinary.contracts).length, 8);
	assert.equal(reviewed.contracts, undefined);
	assert.equal(ordinary.targets["php-wasm"].composer.name
		, "lean-bridge-callbackcheckedrecords/wasm");
	for(const invalid of ["", "raw", "review"])
		assert.throws(() => callbackCheckedRecordPhpWasmConfiguration(invalid));
});

test("PHP-Wasm checked-record caller differs from native PHP only at loading and reporting", async () => {
	const native = await readFile("tests/fixtures/callback-checked-record-consumers/php-native.php", "utf8");
	const weak = await callbackCheckedRecordPhpWasmCaller("weak");
	const strict = await callbackCheckedRecordPhpWasmCaller("strict");
	assert.equal(weak.replace("strict_types=0", "strict_types=1"), strict);
	assert.doesNotMatch(weak, /vendor\/autoload\.php/u);
	assert.ok(weak.includes("'callback_calls' => $calls"));
	assert.ok(native.includes("callback-checked-record-remaining-ok"));
	assert.deepEqual(Object.keys(callbackCheckedRecordPhpWasmExpected).sort()
		, ["callback_calls", "checks", "php", "word_bits"]);
	for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.parse(callbackCheckedRecordPhpWasmRequest(arrangement));
		assert.equal(request.module, "LeanCallbackcheckedrecords");
		assert.equal(request.operations.probe, "call_host");
	}
	await assert.rejects(callbackCheckedRecordPhpWasmCaller("invalid"));
	assert.throws(() => callbackCheckedRecordPhpWasmRequest("invalid"));
});
