/**
 * Named PHP-Wasm cases and private, checked Zend variant representations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { phpVariantReviewedIr } from "./helpers/php-variant-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("PHP-Wasm variants expose named readonly cases with exact wasm32 payload types", () => {
	const ir = phpVariantReviewedIr(), files = generateCopiedPhpZendAdapter(ir);
	assert.deepEqual(files, generateCopiedPhpZendAdapter(structuredClone(ir)));
	const api = files["src/Api.php"], manifest = JSON.parse(files["copied-zend-manifest.json"]);
	assert.equal(manifest.integerBits, 32); assert.equal(manifest.exports.length, 14);
	assert.match(api, /abstract readonly class Signal/); assert.match(api, /final readonly class SignalData extends Signal/);
	for(const name of ["count", "u32", "u64", "i64", "natural", "integer", "word"])
		assert.ok(api.includes(`public \\Brick\\Math\\BigInteger $${name};`), name);
	assert.match(api, /public int \$signedWord;/); assert.match(api, /public bool \$bool;/);
	assert.doesNotMatch(api, /FFI|CData|lean_ctor_|lean_obj_tag|->kind|->cases/);
	assert.equal(manifest.namespace, "LeanVariants");
});

test("Zend variants validate tags and exact field counts before active payload conversion", () => {
	const ir = phpVariantReviewedIr(), files = generateCopiedPhpZendAdapter(ir);
	const manifest = JSON.parse(files["copied-zend-manifest.json"]), c = files[`extension/${manifest.extension}.c`];
	const model = compileCopiedPhpModel(ir, { integerBits: 32, lists: true, variants: true });
	for(const copy of model.surface.copies.filter(copy => copy.variant))
	{
		const input = c.split(`static int lb_to${copy.index}(`)[1].split("\n}")[0];
		const output = c.split(`static int lb_from${copy.index}(`)[1].split("\n}")[0];
		assert.ok(input.indexOf("Z_TYPE_P(tag) != IS_LONG") < input.indexOf("out->kind ="));
		assert.ok(input.includes(`>= ${copy.cases.length}`));
		assert.ok(output.indexOf(`value->kind >= ${copy.cases.length}`) < output.indexOf("switch (value->kind)"));
		for(const [index, branch] of copy.cases.entries())
		{
			assert.ok(input.includes(`case ${index}: {`));
			assert.ok(input.includes(`!= ${branch.fields.length + 1})`));
			assert.ok(output.includes(`add_next_index_long(out, ${index});`));
			for(const field of branch.fields) assert.ok(output.includes(`&value->cases.${branch.name}.${field.name}`));
		}
	}
	assert.match(c, /lb_cleanup\d+\(ctx\); zend_bailout\(\)/);
	assert.doesNotMatch(c, /lean_ctor_|lean_obj_tag/);
});

test("PHP-Wasm variant sources parse and private decoding rejects malformed wire cases", { skip: !existsSync("/usr/bin/php") }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-variant-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = phpVariantReviewedIr(), files = generateCopiedPhpZendAdapter(ir);
	for(const [path, source] of Object.entries(files))
	{
		await saveLakeFile(root, path, source);
		if(path.endsWith(".php")) await runCopied("/usr/bin/php", ["-n", "-l", path], root);
	}
	const model = compileCopiedPhpModel(ir, { integerBits: 32, lists: true, variants: true });
	const signal = model.surface.copy({ kind: "named", id: "lean:Variants.Signal" });
	const buffers = model.surface.copy({ kind: "named", id: "lean:Variants.Buffers" });
	await saveLakeFile(root, "check.php", `<?php
require __DIR__ . '/src/Api.php';
use LeanVariants\\{Bytes, SignalIdle, SignalMarker, BuffersPair};
use LeanVariants\\Internal\\Native;
set_error_handler(function($severity, $message) { throw new RuntimeException($message); });
function check(bool $value): void { if (!$value) throw new RuntimeException('Variant wire assertion'); }
function reject(callable $call): void { try { $call(); } catch (RuntimeException $e) { return; } throw new Error('Missing wire rejection'); }
$from = new ReflectionMethod(Native::class, 'from${signal.index}');
$to = new ReflectionMethod(Native::class, 'to${signal.index}');
check($to->invoke(null, new SignalIdle()) === [0]);
check($from->invoke(null, [0]) instanceof SignalIdle);
check($to->invoke(null, new SignalMarker(null)) === [3, null]);
check($from->invoke(null, [3, null]) instanceof SignalMarker);
foreach ([null, [], [true], ['0'], [-1], [4], [0, 'extra'], [3], [0 => 0, 2 => null]] as $bad) reject(fn() => $from->invoke(null, $bad));
$bytes = new BuffersPair(Bytes::fromString("a\\0"), Bytes::fromString("\\xff"));
$wire = (new ReflectionMethod(Native::class, 'to${buffers.index}'))->invoke(null, $bytes);
check($wire === [1, "a\\0", "\\xff"]);
$out = (new ReflectionMethod(Native::class, 'from${buffers.index}'))->invoke(null, $wire);
check($out instanceof BuffersPair && $out !== $bytes && $out->first !== $bytes->first && $out->first->toString() === "a\\0");
echo 'php-wasm-variants-contract-ok';
`);
	const result = await runCopied("/usr/bin/php", ["-n", "check.php"], root);
	assert.equal(result.stdout, "php-wasm-variants-contract-ok"); assert.equal(result.stderr, "");
	const emcc = resolve(".toolchains/emsdk-php-wasm/upstream/emscripten/emcc"), sdk = resolve("build/php-wasm-sdk/php8.4-src");
	if(existsSync(emcc) && existsSync(sdk))
	{
		const manifest = JSON.parse(files["copied-zend-manifest.json"]);
		await runCopied(emcc, ["-fsyntax-only", "-Wall", "-Wextra", "-Werror"
			, "-Wno-unused-function", "-Wno-unused-parameter", "-Wno-type-limits"
			, ...[sdk, ...["Zend", "main", "TSRM", "ext"].map(path => join(sdk, path)), join(root, "include")].flatMap(path => ["-I", path])
			, `extension/${manifest.extension}.c`], root, process.env);
	}
});
