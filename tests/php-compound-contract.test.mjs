/**
 * Native PHP compound classes, strict validation and typed C layouts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("PHP compounds retain explicit presence, result branches and binary product fields", () => {
	const ir = compoundReviewedIr(), files = generateCopiedPhpPackage(ir);
	assert.deepEqual(files, generateCopiedPhpPackage(structuredClone(ir)));
	const api = files["src/Api.php"], native = files["src/Internal/Native.php"];
	for(const name of ["Some", "Ok", "Err"]) assert.match(api, new RegExp(`final readonly class ${name}`));
	assert.match(api, /function option_unit\(mixed \$value0\): Some\|null/);
	assert.match(api, /function result_unit\(mixed \$value0\): Ok\|Err/);
	assert.match(api, /@return array\{null, null\}/);
	assert.doesNotMatch(api, /FFI|CData|pointer|constructor number/);
	assert.match(native, /uint8_t has_value;/); assert.match(native, /uint8_t is_ok;/);
	assert.match(native, /Prod requires a two-element list/);
	assert.match(native, /get_object_vars\(\$value\)/);
	assert.match(native, /Invalid native Option flag/); assert.match(native, /Invalid native Except flag/);
	assert.doesNotMatch(native, /lean_ctor_|lean_obj_tag|json_decode/);
	const exports = JSON.parse(files["binding-manifest.json"]).exports;
	for(const name of ["Some", "Ok", "Err"]) assert.ok(exports.includes(`LeanCompounds\\${name}`));
	assert.doesNotMatch(generateCopiedPhpPackage(callableReviewedIr())["src/Api.php"], /class (Some|Ok|Err)\b/);
});

for(const name of ["Some", "sOmE", "Ok", "Err"]) test(`PHP rejects the compound class collision ${name}`, () => {
	const ir = compoundReviewedIr(); ir.types.find(type => type.kind === "record").name = name;
	assert.throws(() => compileCopiedPhpModel(ir), /reserved or duplicated/);
	const fn = compoundReviewedIr(); fn.declarations[0].name = name.toLowerCase();
	assert.throws(() => compileCopiedPhpModel(fn), /reserved or duplicated/);
});

test("PHP compound admission leaves Zend and compound callables closed", () => {
	for(const integerBits of [32, 64]) assert.throws(() => generateCopiedPhpZendAdapter(compoundReviewedIr(), { integerBits }), /compound values are not implemented/);
	for(const constructor of ["option", "result", "tuple"])
	{
		for(const position of ["parameter", "result"])
		{
			const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback");
			const site = position === "parameter" ? callback.callable.parameters[0] : callback.callable.result;
			site.type = { kind: "apply", constructor, arguments: Array.from({ length: constructor === "option" ? 1 : 2 }, () => ({ kind: "primitive", name: "unit" })) };
			assert.throws(() => compileCopiedPhpModel(ir), /callbacks currently require copied primitive/);
		}
	}
	const ir = compoundReviewedIr(); ir.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedPhpModel(ir), /copy ownership/);
	let deep = { kind: "primitive", name: "unit" };
	for(let i = 0; i < 34; i++) deep = { kind: "apply", constructor: "option", arguments: [deep] };
	ir.declarations[0].parameters[0].ownership = "copy"; ir.declarations[0].parameters[0].type = deep;
	assert.throws(() => compileCopiedPhpModel(ir), /32 types deep/);
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("generated PHP compounds have valid syntax and strict presence checks without native calls", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-compound-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = compoundReviewedIr(), model = compileCopiedPhpModel(ir);
	for(const [path, source] of Object.entries(generateCopiedPhpPackage(ir)))
	{
		await saveLakeFile(root, path, source);
		if(path.endsWith(".php")) await runCopied(php, ["-n", "-l", path], root);
	}
	const unit = model.surface.copy(ir.declarations.find(fn => fn.name === "option_unit").result.type).index;
	await saveLakeFile(root, "check.php", `<?php
require __DIR__ . '/src/Api.php';
use LeanCompounds\\{Some, Ok, Err};
use LeanCompounds\\Internal\\{Checks, Budget};
function check($value) { if (!$value) throw new RuntimeException('compound contract'); }
function reject($call) { try { $call(); } catch (TypeError|ArgumentCountError|Error $e) { return; } throw new RuntimeException('missing rejection'); }
check(Checks::check${unit}(null, new Budget()) === null);
$some = Checks::check${unit}(new Some(null), new Budget());
check($some instanceof Some && $some->value === null);
reject(fn() => Checks::check${unit}(new Ok(null), new Budget()));
reject(fn() => Checks::check${unit}(new Some(false), new Budget()));
reject(fn() => new Some()); reject(fn() => new Some(null, 1));
reject(fn() => Checks::check${unit}((new ReflectionClass(Some::class))->newInstanceWithoutConstructor(), new Budget()));
reject(function() use ($some) { $some->value = 1; });
echo 'php-compounds-contract-ok';
`);
	const run = await runCopied(php, ["-n", "check.php"], root);
	assert.equal(run.stdout, "php-compounds-contract-ok"); assert.equal(run.stderr, "");
});
