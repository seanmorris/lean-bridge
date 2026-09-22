/**
 * Native PHP List admission, public PHPDoc and bounded FFI output conversion.
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
import { generatePhpBindingPackage } from "../src/backends/php/generate.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("native PHP Lists have checked array signatures and distinct List/Array identities", () => {
	const ir = listReviewedIr(), files = generateCopiedPhpPackage(ir), model = compileCopiedPhpModel(ir, { lists: true });
	assert.equal(model.surface.functions.length, 27);
	assert.deepEqual(files, generateCopiedPhpPackage(structuredClone(ir)));
	const publicFiles = generatePhpBindingPackage(ir);
	assert.equal(publicFiles["src/Api.php"], files["src/Api.php"]);
	assert.match(files["src/Api.php"], /function reverse_uint32\(mixed \$value0\): array/);
	assert.match(files["src/Api.php"], /@return list<int>/);
	assert.match(files["src/Api.php"], /@var list<list<int>>/);
	assert.doesNotMatch(files["src/Api.php"], /FFI|CData|lean_ctor_/);
	const word = { kind: "primitive", name: "uint32" };
	assert.notEqual(model.surface.copy({ kind: "apply", constructor: "list", arguments: [word] }).name,
		model.surface.copy({ kind: "apply", constructor: "array", arguments: [word] }).name);
	assert.match(files["README.md"], /List inputs, results and record fields use consecutive-key PHP arrays/);
	assert.doesNotMatch(files["README.md"], /lists and recursive copied schemas remain unsupported/);
});

test("PHP List output validates length and pointer alignment before element reads", () => {
	const ir = listReviewedIr(), model = compileCopiedPhpModel(ir, { lists: true }), native = generateCopiedPhpPackage(ir)["src/Internal/Native.php"];
	for(const copy of model.surface.copies.filter(copy => copy.element))
	{
		const body = native.split(`private static function from${copy.index}(`)[1].split("\n    }")[0];
		assert.ok(body.indexOf("$scope->budget->charge($value->length") < body.indexOf("if (!$value->length)"));
		assert.ok(body.indexOf("missing buffer") < body.indexOf("$memory ="));
		assert.ok(body.indexOf("misaligned buffer") < body.indexOf("$memory ="));
		assert.match(body, /\$scope->ffi->cast\('uintptr_t \*', \\FFI::addr\(\$value->data\)\)\[0\]/);
		// Read raw Bool bytes so FFI cannot coerce invalid native markers first.
		const ffiType = copy.element.ctype === "bool" ? "uint8_t" : copy.element.ctype;
		assert.ok(body.includes(`FFI::alignof($scope->ffi->type('${ffiType}'))`));
	}
});

test("PHP List admission includes Zend transport but keeps compound callables closed", () => {
	assert.doesNotThrow(() => generateCopiedPhpZendAdapter(listReviewedIr()));
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback");
		const site = position === "parameter" ? callback.callable.parameters[0] : callback.callable.result;
		site.type = { kind: "apply", constructor: "list", arguments: [{ kind: "primitive", name: "uint32" }] };
		assert.throws(() => generateCopiedPhpPackage(ir), /callbacks currently require copied primitive/);
	}
	const ir = listReviewedIr(); ir.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => generateCopiedPhpPackage(ir), /copy ownership/);
	const collision = listReviewedIr(); collision.types[0].name = "sOmE";
	assert.throws(() => generateCopiedPhpPackage(collision), /reserved or duplicated/);
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("generated PHP Lists pass syntax and pointer guards without native library reads", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-list-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = listReviewedIr(), model = compileCopiedPhpModel(ir, { lists: true });
	for(const [path, source] of Object.entries(generateCopiedPhpPackage(ir)))
	{
		await saveLakeFile(root, path, source);
		if(path.endsWith(".php")) await runCopied(php, ["-n", "-l", path], root);
	}
	const copy = model.surface.copy(ir.declarations.find(fn => fn.name === "reverse_uint32").result.type);
	await saveLakeFile(root, "check.php", `<?php
require __DIR__ . '/src/Api.php';
use LeanLists\\Internal\\{Checks, Budget, Native, Scope};
function check(bool $value): void { if (!$value) throw new RuntimeException('List contract'); }
function reject(callable $call, string $kind): void { try { $call(); } catch (Throwable $e) { check($e instanceof $kind); return; } throw new RuntimeException('missing rejection'); }
check(Checks::check${copy.index}([1, 2, 1], new Budget()) === [1, 2, 1]);
reject(fn() => Checks::check${copy.index}([1 => 1], new Budget()), TypeError::class);
reject(fn() => Checks::check${copy.index}([1, '2'], new Budget()), TypeError::class);
$ffi = FFI::cdef('typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } ${copy.ctype};');
$value = $ffi->new('${copy.ctype}');
$method = new ReflectionMethod(Native::class, 'from${copy.index}');
$value->data = $ffi->cast('void *', 1);
check($method->invoke(null, $value, new Scope($ffi)) === []);
$value->length = 1;
reject(fn() => $method->invoke(null, $value, new Scope($ffi)), RuntimeException::class);
$value->data = null;
reject(fn() => $method->invoke(null, $value, new Scope($ffi)), RuntimeException::class);
$value->length = PHP_INT_MAX;
reject(fn() => $method->invoke(null, $value, new Scope($ffi)), ValueError::class);
echo 'php-lists-contract-ok';
`);
	const run = await runCopied(php, ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "check.php"], root);
	assert.equal(run.stdout, "php-lists-contract-ok"); assert.equal(run.stderr, "");
});
