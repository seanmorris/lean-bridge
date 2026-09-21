/**
 * Public PHP constructor identities and private checked variant conversions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { generateCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { generatePhpBindingPackage } from "../src/backends/php/generate.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { phpVariantReviewedIr } from "./helpers/php-variant-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("PHP variants expose readonly families and named cases without transport layouts", () => {
	const ir = phpVariantReviewedIr(), files = generateCopiedPhpPackage(ir);
	assert.deepEqual(files, generateCopiedPhpPackage(structuredClone(ir)));
	assert.equal(files["src/Api.php"], generatePhpBindingPackage(ir)["src/Api.php"]);
	assert.match(files["src/Api.php"], /abstract readonly class Signal/);
	assert.match(files["src/Api.php"], /final readonly class SignalData extends Signal/);
	assert.match(files["src/Api.php"], /public function __construct\(mixed \$count, mixed \$label\)/);
	assert.match(files["src/Api.php"], /public bool \$bool;/);
	assert.match(files["src/Api.php"], /public int \$arg1;[^]*public string \$arg1_;/);
	assert.match(files["src/Api.php"], /function echo_signal\(mixed \$value0\): Signal/);
	assert.doesNotMatch(files["src/Api.php"], /FFI|CData|lean_ctor_|uint32_t|->kind|->cases/);
	const manifest = JSON.parse(files["binding-manifest.json"]);
	for(const name of ["Signal", "SignalIdle", "SignalStopped", "SignalData", "SignalMarker", "ScalarsAll", "AnonymousCollision"])
		assert.ok(manifest.exports.includes(`LeanVariants\\${name}`));
	assert.match(files["README.md"], /Tagged variants/);
});

test("PHP variants preserve source field names and reject tags before reading the active C union", () => {
	const ir = phpVariantReviewedIr(), model = compileCopiedPhpModel(ir, { lists: true, variants: true });
	const source = generateCopiedPhpPackage(ir)["src/Internal/Native.php"];
	for(const copy of model.surface.copies.filter(copy => copy.variant))
	{
		const output = source.split(`private static function from${copy.index}(`)[1].split("\n    }")[0];
		assert.ok(output.includes("switch ($value->kind)"));
		assert.ok(output.indexOf("switch ($value->kind)") < output.indexOf("->cases") || !copy.cases.some(branch => branch.fields.length));
		assert.match(output, /default: throw new \\RuntimeException\('Invalid native .* constructor'\)/);
		assert.ok(source.includes(`} ${copy.ctype};`));
	}
	assert.match(source, /\$value->bool/); assert.match(source, /->bool_/);
	assert.match(source, /\$value->signedWord/); assert.match(source, /->signed_word/);
	assert.match(source, /array_keys\(get_object_vars\(\$value\)\)/);
});

test("PHP variant naming rejects collisions and keeps disabled transports closed", () => {
	for(const rename of ["SignalData", "sIgNaL", "Some"])
	{
		const ir = phpVariantReviewedIr(); ir.types.find(type => type.name === "Packet").name = rename;
		assert.throws(() => generateCopiedPhpPackage(ir), /reserved|duplicated|collision/i);
	}
	for(const field of ["this", "GLOBALS", "_SERVER", "__lbBudget"])
	{
		const ir = phpVariantReviewedIr(); ir.types.find(type => type.name === "Signal").cases[2].fields[0].name = field;
		assert.throws(() => generateCopiedPhpPackage(ir), /reserved|invalid|collid/i);
	}
	const duplicate = phpVariantReviewedIr(); duplicate.types.find(type => type.name === "Signal").cases[1].name = "IDLE";
	assert.throws(() => generateCopiedPhpPackage(duplicate), /reserved|duplicated|collision/i);
	const underscore = phpVariantReviewedIr(); underscore.types.find(type => type.name === "Signal").cases[0].name = "idle_";
	assert.match(generateCopiedPhpPackage(underscore)["src/Api.php"], /class SignalIdle_ extends Signal/);
	assert.throws(() => generateCopiedPhpZendAdapter(phpVariantReviewedIr()), /copied primitives, arrays or acyclic records/);
	assert.throws(() => compileCopiedPhpModel(phpVariantReviewedIr(), { lists: true, variants: false }), /copied primitives, arrays or acyclic records/);
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), variants = phpVariantReviewedIr(); ir.types.push(...variants.types);
		const callback = ir.types.find(type => type.kind === "callback");
		const site = position === "parameter" ? callback.callable.parameters[0] : callback.callable.result;
		site.type = { kind: "named", id: "lean:Variants.Signal" };
		assert.throws(() => generateCopiedPhpPackage(ir), /callbacks currently require copied primitive/);
	}
	const recursive = phpVariantReviewedIr(); recursive.types.find(type => type.name === "Signal").cases[2].fields[0].type = { kind: "named", id: "lean:Variants.Signal" };
	assert.throws(() => generateCopiedPhpPackage(recursive), /acyclic|deep/);
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("generated PHP variant classes parse and enforce readonly exact-case checks in weak callers", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-variant-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = phpVariantReviewedIr(), model = compileCopiedPhpModel(ir, { lists: true, variants: true });
	for(const [path, source] of Object.entries(generateCopiedPhpPackage(ir)))
	{
		await saveLakeFile(root, path, source);
		if(path.endsWith(".php")) await runCopied(php, ["-n", "-l", path], root);
	}
	const copy = model.surface.copy({ kind: "named", id: "lean:Variants.Signal" });
	await saveLakeFile(root, "check.php", `<?php
require __DIR__ . '/src/Api.php';
use LeanVariants\\{Signal, SignalIdle, SignalStopped, SignalData, SignalMarker};
use LeanVariants\\Internal\\{Budget, Checks, Native, Scope};
function check(bool $value): void { if (!$value) throw new RuntimeException('PHP variant contract'); }
function reject(callable $call, string $kind): void { try { $call(); } catch (Throwable $e) { check($e instanceof $kind); return; } throw new RuntimeException('missing rejection'); }
$input = new SignalData(count: 42, label: "ok\\0");
check($input instanceof Signal && $input->count === 42 && $input->label === "ok\\0");
check(Checks::check${copy.index}($input, new Budget()) === $input);
check(new SignalIdle() != new SignalStopped()); check(new SignalMarker(null) instanceof Signal);
reject(fn() => new SignalData('42', 'ok'), TypeError::class);
reject(fn() => new SignalData(42, 1), TypeError::class);
reject(fn() => new SignalMarker(1), TypeError::class);
reject(fn() => new SignalIdle(1), ArgumentCountError::class);
reject(fn() => $input->count = 7, Error::class);
readonly class ForeignSignal extends Signal {}
reject(fn() => Checks::check${copy.index}(new ForeignSignal(), new Budget()), TypeError::class);
$empty = (new ReflectionClass(SignalData::class))->newInstanceWithoutConstructor();
reject(fn() => Checks::check${copy.index}($empty, new Budget()), TypeError::class);
$ffi = FFI::cdef('typedef struct { void *data; size_t length; void *owner; void (*release)(void *); } Text; typedef struct { uint32_t kind; union { struct { uint8_t empty; } idle; struct { uint8_t empty; } stopped; struct { uint32_t count; Text label; } data; struct { uint8_t value; } marker; } cases; } ${copy.ctype};');
$value = $ffi->new('${copy.ctype}'); FFI::memset(FFI::addr($value), 255, FFI::sizeof($value));
$method = new ReflectionMethod(Native::class, 'from${copy.index}');
reject(fn() => $method->invoke(null, $value, new Scope($ffi)), RuntimeException::class);
$value->kind = 0; check($method->invoke(null, $value, new Scope($ffi)) instanceof SignalIdle);
$value->kind = 1; check($method->invoke(null, $value, new Scope($ffi)) instanceof SignalStopped);
echo 'php-variants-contract-ok';
`);
	const run = await runCopied(php, ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "check.php"], root);
	assert.equal(run.stdout, "php-variants-contract-ok"); assert.equal(run.stderr, "");
});
