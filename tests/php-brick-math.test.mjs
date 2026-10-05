/**
 * Standard integer objects, pinned offline dependencies and strict boundaries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { brickMathSources, brickMathRequirement, bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { brickMathRepository } from "./helpers/brick-math.mjs";
import { copiedZendFixture } from "./helpers/php-copied-zend.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("PHP packages use the pinned upstream integer class without a package-local wrapper", () => {
	const files = brickMathSources();
	assert.equal(Object.keys(files).length, 25);
	assert.match(files.LICENSE, /Permission is hereby granted/);
	assert.deepEqual(brickMathRequirement, { "brick/math": "1.0.0" });
	assert.deepEqual(JSON.parse(files["composer.json"]).autoload, { "psr-4": { "Brick\\Math\\": "src/" } });
	for(const integerBits of [32, 64])
	{
		const generated = generateCopiedPhpZendAdapter(copiedZendFixture(), { integerBits });
		assert.doesNotMatch(generated["src/Api.php"], /class BigInteger|fromDecimal/);
		assert.match(generated["src/Api.php"], /\\Brick\\Math\\BigInteger/);
		assert.match(generated["src/Internal/Native.php"], /16384/);
	}
});

test("offline Composer resolves Brick Math automatically and bridge checks reject invalid exact values", { timeout: 90_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-brick-math-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const repository = await brickMathRepository(join(root, "feed"));
	const ir = copiedZendFixture(), generated = generateCopiedPhpZendAdapter(ir);
	for(const [path, text] of Object.entries(generated).filter(([path]) => path.endsWith(".php"))) await saveLakeFile(root, path, text);
	const manifest = { name: "test/generated-integers", require: { php: "^8.2", ...brickMathRequirement }, repositories: [{ "packagist.org": false }], autoload: { files: ["src/Api.php"] }, config: { "allow-plugins": false } };
	await saveLakeFile(root, "composer.json", JSON.stringify(manifest));
	const env = { ...process.env, COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1", COMPOSER_HOME: join(root, "composer-home"), COMPOSER_CACHE_DIR: join(root, "composer-cache") };
	const install = () => processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_COMPOSER ?? "composer", args: ["--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist", "--no-dev"], cwd: root, env });
	await assert.rejects(install, error => {
		assert.equal(error.code, "build-command-failed");
		assert.match(error.details.stderr, /brick\/math[^\n]*could not be found/);
		return true;
	});
	manifest.repositories.push(repository);
	await saveLakeFile(root, "composer.json", JSON.stringify(manifest));
	await install();
	const lock = JSON.parse(await readFile(join(root, "composer.lock"), "utf8"));
	assert.equal(lock.packages.length, 1); assert.equal(lock.packages[0].name, "brick/math"); assert.equal(lock.packages[0].version, "1.0.0");
	const model = compileCopiedPhpModel(ir, { integerBits: 32 });
	const check = type => `\\LeanWillow\\Internal\\Checks::check${model.surface.copies.find(copy => copy.ref.name === type).index}`;
	await saveLakeFile(root, "test.php", `<?php
declare(strict_types=1);
require 'vendor/autoload.php';
use Brick\\Math\\BigInteger;
$budget = new LeanWillow\\Internal\\Budget();
$value = BigInteger::of('4294967295');
if ((string) BigInteger::parse('18446744073709551615', allowedSyntax: [], maxDigits: 16384) !== '18446744073709551615') throw new Exception('Bounded parsing changed');
foreach (['1e1000000', str_repeat('9', 16385)] as $text) {
    try { BigInteger::parse($text, allowedSyntax: [], maxDigits: 16384); }
    catch (Brick\\Math\\Exception\\MathException $error) { continue; }
    throw new Exception('Untrusted text was not bounded');
}
if (${check("uint32")}($value, $budget) !== $value) throw new Exception('Not the upstream object');
if ((string) ${check("nat")}($value->plus(1), $budget) !== '4294967296') throw new Exception('Lost arithmetic');
if ((string) ${check("int")}($value->negated(), $budget) !== '-4294967295') throw new Exception('Lost sign');
foreach (['01', '+1', '1.0'] as $text) if ((string) ${check("nat")}(BigInteger::of($text), $budget) !== '1') throw new Exception('Lost normalization');
$invalid = [fn() => ${check("nat")}(BigInteger::of('-1'), $budget), fn() => ${check("nat")}(BigInteger::of(str_repeat('9', 16385)), $budget), fn() => ${check("uint32")}($value->plus(1), $budget), fn() => ${check("uint64")}(BigInteger::of('18446744073709551616'), $budget), fn() => ${check("int64")}(BigInteger::of('-9223372036854775809'), $budget)];
foreach ($invalid as $call) { try { $call(); } catch (ValueError $error) { continue; } throw new Exception('Missing range check'); }
foreach ([1, 1.0, '1', Brick\\Math\\BigDecimal::of('1')] as $bad) { try { ${check("nat")}($bad, $budget); } catch (TypeError $error) { continue; } throw new Exception('Accepted another public type'); }
echo 'exact';
`);
	const run = () => processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_PHP ?? "php", args: ["-n", "test.php"], cwd: root });
	assert.equal((await run()).stdout, "exact");
	// The npm path supplies identical upstream classes without Composer.
	for(const [path, text] of Object.entries(bundledBrickMath())) await saveLakeFile(root, path, text);
	const php = await readFile(join(root, "test.php"), "utf8");
	await saveLakeFile(root, "test.php", php.replace("require 'vendor/autoload.php';", "require 'dependencies/brick-math/autoload.php'; require 'src/Api.php';"));
	assert.equal((await run()).stdout, "exact");
});
