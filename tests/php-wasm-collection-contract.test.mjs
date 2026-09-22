/**
 * Exact wasm32 collection types and guards before native output reads.
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
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { phpWasmCollectionConsumer } from "./helpers/php-wasm-collection-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("wasm32 collection types preserve every primitive, source field and empty record", () => {
	const model = compileCopiedPhpModel(collectionReviewedIr(), { integerBits: 32 });
	const copies = model.surface.copies;
	assert.equal(model.surface.functions.length, 35);
	assert.equal(copies.filter(copy => copy.record).length, 7);
	for(const name of ["uint32", "uint64", "int64", "nat", "int", "usize"])
		assert.equal(model.surface.copy({ kind: "primitive", name }).publicType, "\\Brick\\Math\\BigInteger");
	assert.equal(model.surface.copy({ kind: "primitive", name: "isize" }).publicType, "int");
	const fields = copies.find(copy => copy.record?.name === "Primitives").fields;
	assert.equal(fields.length, 19);
	assert.ok(fields.some(field => field.publicName === "char"));
	assert.ok(fields.some(field => field.publicName === "bytes"));
	assert.equal(copies.find(copy => copy.record?.name === "Empty").publicName, "Empty_");
	let deep = model.surface.copy(model.surface.functions.find(fn => fn.field === "deep").declaration.result.type), depth = 0;
	while(deep.element)
	{
		deep = deep.element; depth++;
	}
	assert.equal(depth, 24); assert.equal(deep.scalarName, "uint32");
});

for(const integerBits of [32, 64]) test(`Zend ${integerBits}-bit collection output guards precede reads and coercion`, () => {
	const ir = collectionReviewedIr(), model = compileCopiedPhpModel(ir, { integerBits });
	const files = generateCopiedPhpZendAdapter(ir, { integerBits }), manifest = JSON.parse(files["copied-zend-manifest.json"]);
	const c = files[`extension/${manifest.extension}.c`];
	const body = name => c.split(`static int lb_from${model.surface.copies.find(copy => copy.scalarName === name).index}(`)[1].split("\n}")[0];
	assert.match(body("unit"), /if \(\*value != 0\)[\s\S]*ZVAL_NULL/u);
	assert.match(body("bool"), /memcpy\(&raw, value, sizeof\(raw\)\)[\s\S]*raw > 1[\s\S]*ZVAL_BOOL\(out, raw\)/u);
	assert.doesNotMatch(body("bool"), /ZVAL_BOOL\(out, \*value\)/u);
	assert.match(body("int"), /memcpy\(&negative, &value->negative[\s\S]*negative > 1[\s\S]*lb_big_out/u);
	for(const name of ["string", "bytes"])
	{
		const converter = body(name), guard = converter.indexOf("lb_readable(s, value->data");
		assert.ok(guard >= 0 && guard < converter.indexOf("ZVAL_STRINGL"));
		if(name === "string") assert.ok(guard < converter.indexOf("lb_utf8"));
	}
	const big = c.split("static int lb_big_out(")[1].split("\n}")[0];
	assert.ok(big.indexOf("length > 1701") < big.indexOf("lb_readable"));
	assert.ok(big.indexOf("lb_readable") < big.indexOf("words[length - 1]"));
	assert.match(big, /lb_readable\(s, words, length, sizeof\(\*words\), _Alignof\(uint32_t\)\)/u);
	const buffer = c.split("static int lb_readable(")[1].split("\n}")[0];
	assert.match(buffer, /if \(!count\) return 1/u);
	assert.match(buffer, /count > SIZE_MAX \/ width/u);
	assert.match(buffer, /\(uintptr_t\)data % alignment/u);
	assert.match(buffer, /__builtin_wasm_memory_size\(0\) \* 65536/u);
	assert.match(c, /lb_readable\(&ctx->scope, ctx->error\.message, length, 1, 1\)[\s\S]*memcpy\(native_message/u);
	assert.doesNotMatch(c, /lean_ctor_|lean_obj_tag/u);
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("all wasm32 collection PHP and Zend sources pass compiler syntax checks", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-collection-syntax-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateCopiedPhpZendAdapter(collectionReviewedIr());
	for(const [path, source] of Object.entries({ ...files, "weak.php": phpWasmCollectionConsumer("weak", "ordinary-source"), "strict.php": phpWasmCollectionConsumer("strict", "reviewed-ir") }))
	{
		await saveLakeFile(root, path, source);
		if(path.endsWith(".php")) await runCopied(php, ["-n", "-l", path], root);
	}
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
