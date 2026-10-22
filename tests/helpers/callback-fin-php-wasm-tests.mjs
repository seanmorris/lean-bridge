/**
 * Fast contract controls for PHP-Wasm checked Fin callbacks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	callbackFinPhpWasmCaller, callbackFinPhpWasmConfiguration
	, callbackFinPhpWasmExpected, callbackFinPhpWasmExports
	, callbackFinPhpWasmRequest, callbackFinPhpWasmReview
} from "./callback-fin-php-wasm-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("PHP-Wasm Fin callback selections reconcile ordinary and reviewed author routes", () => {
	const ordinary = callbackFinPhpWasmConfiguration("ordinary");
	const reviewed = callbackFinPhpWasmConfiguration("reviewed");
	assert.deepEqual(ordinary.exports, callbackFinPhpWasmExports);
	assert.equal(reviewed.exports, undefined);
	assert.equal(callbackFinPhpWasmReview().declarations.length, callbackFinPhpWasmExports.length);
	for(const invalid of ["", "raw", "review"])
		assert.throws(() => callbackFinPhpWasmConfiguration(invalid));
});

test("PHP-Wasm Fin callback caller keeps strictness, loading and exact report closed", async t => {
	const weak = await callbackFinPhpWasmCaller("weak");
	const strict = await callbackFinPhpWasmCaller("strict");
	assert.match(weak, /^<\?php\n\/\/ Installed PHP-Wasm acceptance[^\n]+\ndeclare\(strict_types=0\);/u);
	assert.match(strict, /declare\(strict_types=1\);/u);
	assert.equal(weak.replace("strict_types=0", "strict_types=1"), strict);
	for(const arrangement of ["embedded", "composer"])
	{
		const request = JSON.parse(callbackFinPhpWasmRequest(arrangement));
		assert.equal(request.module, "LeanReviewedcallbacks");
		assert.equal(request.operations.probe, "visit");
	}
	assert.deepEqual(Object.keys(callbackFinPhpWasmExpected).sort()
		, ["callback_calls", "checks", "php", "rejections", "word_bits"]);
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-callback-fin-php-wasm-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, "nested"));
	await saveLakeFile(root, "nested/caller.php", weak);
	assert.equal(await readFile(join(root, "nested/caller.php"), "utf8"), weak);
	await assert.rejects(callbackFinPhpWasmCaller("invalid"));
	assert.throws(() => callbackFinPhpWasmRequest("invalid"));
});
