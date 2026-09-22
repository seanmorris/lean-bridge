/**
 * Original record names and exact constructors shared by FFI and Zend packages.
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
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const generators = [
	["ffi", generateCopiedPhpPackage]
	, ["zend32", ir => generateCopiedPhpZendAdapter(ir, { integerBits: 32 })]
	, ["zend64", ir => generateCopiedPhpZendAdapter(ir, { integerBits: 64 })]
];

test("PHP collections preserve all source properties and escape keyword class names", () => {
	for(const integerBits of [32, 64])
	{
		const model = compileCopiedPhpModel(collectionReviewedIr(), { integerBits });
		const records = model.surface.copies.filter(copy => copy.record);
		assert.equal(records.length, 7);
		assert.equal(model.surface.functions.length, 35);
		assert.equal(records.find(copy => copy.record.name === "Empty").publicName, "Empty_");
		for(const copy of records)
			assert.deepEqual(copy.fields.map(field => field.publicName), copy.record.fields.map(field => field.name));
		assert.equal(records.find(copy => copy.record.name === "Primitives").fields.length, 19);
	}
	for(const [, generate] of generators)
	{
		const ir = collectionReviewedIr(), files = generate(ir);
		assert.deepEqual(files, generate(structuredClone(ir)));
		assert.match(files["src/Api.php"], /final readonly class Empty_/u);
		assert.match(files["src/Api.php"], /public Bytes \$bytes;/u);
		assert.match(files["src/Api.php"], /public string \$char;/u);
		assert.doesNotMatch(files["src/Api.php"], /public string \$char_;/u);
		assert.doesNotMatch(files["src/Api.php"], /FFI|CData|lean_ctor_|uint32_t/u);
	}
});

test("PHP record names retain underscores and reject reserved variables or escaped collisions", () => {
	const original = collectionReviewedIr();
	const renamed = structuredClone(original), pair = renamed.types.find(type => type.name === "Pair");
	pair.fields[0].name = "class"; pair.fields[1].name = "tail__";
	for(const [, generate] of generators)
	{
		const files = generate(renamed);
		assert.match(files["src/Api.php"], /mixed \$class, mixed \$tail__/u);
		assert.match(files["src/Internal/Native.php"], /\$value->class\b/u);
		assert.match(files["src/Internal/Native.php"], /\$value->tail__\b/u);
		const duplicate = structuredClone(renamed);
		duplicate.types.find(type => type.name === "Pair").fields[1].name = "class_";
		assert.throws(() => generate(duplicate), /reserved|duplicated|collid/iu);
		for(const field of ["this", "GLOBALS", "_SERVER", "__lbBudget"])
		{
			const invalid = structuredClone(original);
			invalid.types.find(type => type.name === "Pair").fields[0].name = field;
			assert.throws(() => generate(invalid), /reserved|invalid|collid/iu);
		}
		for(const name of ["Empty_", "eMpTy_", "Bytes", "BigInteger", "Internal"])
		{
			const invalid = structuredClone(original);
			invalid.types.find(type => type.name === "Single").name = name;
			assert.throws(() => generate(invalid), /reserved|duplicated|collid/iu);
		}
	}
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("PHP record constructors parse and reject extra or uninitialized fields without a Lean runtime", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-collection-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [profile, generate] of generators)
	{
		const ir = collectionReviewedIr();
		// Keep this syntax/constructor probe independent of Brick Math installation.
		ir.types.find(type => type.name === "Pair").fields[0].type = { kind: "primitive", name: "uint8" };
		const model = compileCopiedPhpModel(ir), pair = model.surface.copies.find(copy => copy.record?.name === "Pair");
		const empty = model.surface.copies.find(copy => copy.record?.name === "Empty");
		const directory = join(root, profile);
		for(const [path, source] of Object.entries(generate(ir)))
		{
			await saveLakeFile(directory, path, source);
			if(path.endsWith(".php")) await runCopied(php, ["-n", "-l", path], directory);
		}
		await saveLakeFile(directory, "check.php", `<?php
require __DIR__ . '/src/Api.php';
use LeanCollections\\{Pair, Empty_};
use LeanCollections\\Internal\\{Budget, Checks};
function check(bool $value): void { if (!$value) throw new RuntimeException('PHP record contract'); }
function reject(callable $call, string $kind): void { try { $call(); } catch (Throwable $error) { check($error instanceof $kind); return; } throw new RuntimeException('Missing rejection'); }
$value = new Pair(first: 42, second: "ok\\0");
check($value->first === 42 && $value->second === "ok\\0");
check(Checks::check${pair.index}($value, new Budget()) === $value);
check(Checks::check${empty.index}(new Empty_(), new Budget()) instanceof Empty_);
reject(fn() => new Pair('42', 'ok'), TypeError::class);
reject(fn() => new Pair(42, 1), TypeError::class);
reject(fn() => new Pair(256, 'ok'), ValueError::class);
reject(fn() => new Pair(42, 'ok', 1), ArgumentCountError::class);
reject(fn() => new Empty_(1), ArgumentCountError::class);
reject(fn() => $value->first = 7, Error::class);
reject(fn() => Checks::check${pair.index}((new ReflectionClass(Pair::class))->newInstanceWithoutConstructor(), new Budget()), TypeError::class);
reject(fn() => Checks::check${pair.index}((object) ['first' => 42, 'second' => 'ok'], new Budget()), TypeError::class);
echo 'php-collections-contract-ok';
`);
		const result = await runCopied(php, ["-n", "check.php"], directory);
		assert.equal(result.stdout, "php-collections-contract-ok"); assert.equal(result.stderr, "");
	}
});
