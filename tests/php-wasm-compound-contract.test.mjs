/**
 * Zend compound admission, explicit wire branches and both PHP integer widths.
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
import { createPhpWasmCopiedModel } from "../src/build/native-model.mjs";
import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("PHP-Wasm admits nested copied compounds but rejects compound callables", () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const option = { kind: "option", element: projection.result, abi };
	projection.parameters[0].type = { kind: "tuple", arguments: [option, { kind: "result", arguments: [option, option], abi }], abi };
	projection.result = projection.parameters[0].type;
	const model = createPhpWasmCopiedModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
	assert.equal(model.pointerBits, 32); assert.doesNotThrow(() => generateCopiedPhpZendAdapter(model.bindingIr));
	for(const constructor of ["option", "result", "tuple"])
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback").callable;
		const site = position === "parameter" ? callback.parameters[0] : callback.result;
		site.type = { kind: "apply", constructor, arguments: Array.from({ length: constructor === "option" ? 1 : 2 }, () => ({ kind: "primitive", name: "unit" })) };
		assert.throws(() => generateCopiedPhpZendAdapter(ir), /callbacks currently require copied primitive/);
	}
});

for(const integerBits of [32, 64]) test(`Zend ${integerBits}-bit compound sources retain explicit tags and typed payloads`, () => {
	const ir = compoundReviewedIr(), files = generateCopiedPhpZendAdapter(ir, { integerBits });
	assert.deepEqual(files, generateCopiedPhpZendAdapter(structuredClone(ir), { integerBits }));
	const manifest = JSON.parse(files["copied-zend-manifest.json"]), c = files[`extension/${manifest.extension}.c`];
	for(const name of ["Some", "Ok", "Err"]) assert.match(files["src/Api.php"], new RegExp(`final readonly class ${name}`));
	assert.match(files["src/Api.php"], /function option_unit\(mixed \$value0\): Some\|null/);
	assert.match(c, /Option wire requires null or one payload/); assert.match(c, /Except wire tag requires bool/);
	assert.match(c, /Invalid native Option flag/); assert.match(c, /Invalid native Except flag/);
	assert.match(c, /Prod wire field count differs/); assert.match(c, /zval_ptr_dtor\(&item\)/);
	assert.match(c, /zend_catch \{ lb_cleanup/);
	assert.doesNotMatch(files["src/Api.php"], /FFI|CData|pointer|constructor number/);
	assert.doesNotMatch(c, /lean_ctor_|lean_obj_tag|json_decode/);
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("PHP-Wasm compound PHP wire preserves presence without loading native code", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-compound-syntax-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = compoundReviewedIr(), files = generateCopiedPhpZendAdapter(ir), model = compileCopiedPhpModel(ir, { integerBits: 32 });
	for(const [path, source] of Object.entries(files))
	{
		await saveLakeFile(root, path, source);
		if(path.endsWith(".php")) await runCopied(php, ["-n", "-l", path], root);
	}
	const ref = name => model.surface.copy(ir.declarations.find(fn => fn.name === name).parameters[0].type).index;
	await saveLakeFile(root, "check.php", `<?php
require __DIR__ . '/src/Api.php';
use LeanCompounds\\{Some, Ok, Err};
use LeanCompounds\\Internal\\Native;
function wire($type, $input) {
  $to = new ReflectionMethod(Native::class, 'to' . $type);
  $from = new ReflectionMethod(Native::class, 'from' . $type);
  $wire = $to->invoke(null, $input);
  if ($from->invoke(null, $wire) != $input) throw new RuntimeException('Presence collapsed');
  return $wire;
}
$states = [null, new Some(null), new Some(new Some(null))];
foreach ($states as $index => $input) {
  if (wire(${ref("classify")}, $input) !== [null, [null], [[null]]][$index]) throw new RuntimeException('Option wire differs');
}
if (wire(${ref("result_unit")}, new Ok(null)) !== [true, null]) throw new RuntimeException('Ok lost');
if (wire(${ref("result_unit")}, new Err(null)) !== [false, null]) throw new RuntimeException('Err lost');
if (wire(${ref("tuple_unit")}, [null, null]) !== [null, null]) throw new RuntimeException('Product lost');
echo 'zend-compound-wire-ok';
`);
	assert.equal((await runCopied(php, ["-n", "check.php"], root)).stdout, "zend-compound-wire-ok");
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
