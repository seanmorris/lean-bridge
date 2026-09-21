/**
 * Zend List admission, wasm32 host types and pre-read sequence validation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { createPhpWasmCopiedModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("PHP-Wasm admits typed List conversions with a wasm32 traversal bound", () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const list = { kind: "list", element: projection.result, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };
	projection.parameters[0].type = list; projection.result = list;
	const model = createPhpWasmCopiedModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
	assert.equal(model.pointerBits, 32); assert.doesNotThrow(() => generateCopiedPhpZendAdapter(model.bindingIr));
	const adapters = generateNativeLeanAdapters(model);
	assert.match(adapters.leanSource, /value\.toList/); assert.match(adapters.leanSource, /loop 4194305 value #\[\]/);
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback").callable;
		const site = position === "parameter" ? callback.parameters[0] : callback.result;
		site.type = { kind: "apply", constructor: "list", arguments: [{ kind: "primitive", name: "unit" }] };
		assert.throws(() => generateCopiedPhpZendAdapter(ir), /callbacks currently require copied primitive/);
	}
});

for(const integerBits of [32, 64]) test(`Zend ${integerBits}-bit Lists preserve typed public arrays and guard native buffers`, () => {
	const ir = listReviewedIr(), files = generateCopiedPhpZendAdapter(ir, { integerBits });
	assert.deepEqual(files, generateCopiedPhpZendAdapter(structuredClone(ir), { integerBits }));
	const manifest = JSON.parse(files["copied-zend-manifest.json"]), c = files[`extension/${manifest.extension}.c`];
	assert.match(files["src/Api.php"], /function reverse_uint32\(mixed \$value0\): array/);
	assert.ok(files["src/Api.php"].includes(integerBits === 32 ? "@return list<\\Brick\\Math\\BigInteger>" : "@return list<int>"));
	assert.doesNotMatch(files["src/Api.php"], /FFI|CData|lean_ctor_/);
	const model = compileCopiedPhpModel(ir, { integerBits, lists: true });
	for(const copy of model.surface.copies.filter(copy => copy.element))
	{
		const body = c.split(`static int lb_from${copy.index}(`)[1].split("\n}")[0];
		const allocation = body.indexOf("array_init_size");
		assert.ok(allocation >= 0);
		for(const guard of ["lb_charge(s, value->length", `value->length && (uintptr_t)value->data % _Alignof(${copy.element.ctype})`, "__builtin_wasm_memory_size(0)"])
		{
			const check = body.indexOf(guard);
			assert.ok(check >= 0 && check < allocation, guard);
		}
		assert.match(body, /value->length && \(\(uint64_t\)\(uintptr_t\)value->data/);
	}
	assert.doesNotMatch(c, /lean_ctor_|lean_obj_tag|json_decode/);
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("PHP-Wasm List PHP and Zend sources compile without loading a Lean runtime", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-list-syntax-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateCopiedPhpZendAdapter(listReviewedIr());
	for(const [path, source] of Object.entries(files))
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
