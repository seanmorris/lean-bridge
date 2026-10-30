/**
 * Compiler-free controls for native PHP and PHP-Wasm proof erasure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCopiedPhpPackage } from "../../src/backends/php/copied-values.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { directProofErasureReview } from "./direct-proof-erasure-fixture.mjs";
import {
	directProofErasurePhpComponentFact
	, directProofErasurePhpComponentFactKeys
} from "./direct-proof-erasure-packages.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("PHP direct proof facts identify both compiled components", () => {
	const hash = suffix => suffix.repeat(64).slice(0, 64);
	const component = prefix => ({
		artifactsSha256: hash(prefix)
		, bindingIrFileSha256: hash("b")
		, bindingIrSha256: hash("c")
		, componentReceiptSha256: hash("d")
		, erasedProofs: 2
		, generatedLeanSha256: hash("e")
		, metadataSha256: hash("f")
		, modelSha256: hash("0")
		, runtimeParameters: 1
	});
	const native = component("a");
	native.nativeComponentReceiptSha256 = native.componentReceiptSha256;
	delete native.componentReceiptSha256;
	const fact = directProofErasurePhpComponentFact({
		native, phpWasm: component("1")
	});
	assert.deepEqual(Object.keys(fact).sort()
		, [...directProofErasurePhpComponentFactKeys].sort());
	assert.ok(Object.values(fact).every(value => value !== undefined));
});

test("PHP direct proof callers expose one word and refuse named proof arguments", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-direct-proof-php-static-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const api = generateCopiedPhpPackage(directProofErasureReview())["src/Api.php"];
	assert.match(api, /namespace LeanDirectprooferasure;/u);
	assert.match(api, /function keep\(mixed \$value\): int/u);
	assert.doesNotMatch(api, /(?:\bTrue\b|\bproof\b|_before|_after)/iu);
	const model = `<?php
namespace LeanDirectprooferasure;
function keep(mixed $value): int { return $value; }
`;
	await saveLakeFile(root, "model.php", model);
	const caller = (await readFile(
		"tests/fixtures/direct-proof-erasure-consumers/php.php", "utf8"
	)).replace("require 'vendor/autoload.php';", "require __DIR__ . '/model.php';");
	await saveLakeFile(root, "consumer.php", caller);
	const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
	const syntax = await runCopied(php, ["-n", "-l", "consumer.php"], root);
	assert.equal(syntax.stderr, "");
	const run = await runCopied(php, ["-n", "consumer.php"], root
		, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	assert.equal(run.stderr, "");
	assert.equal(run.stdout, "direct-proof-php:1005\n");
});

test("PHP direct proof runner owns both routes and retained verification", async () => {
	const source = await readFile("scripts/run-direct-proof-erasure-php-ci.sh", "utf8");
	for(const required of [
		"LEAN_BRIDGE_DIRECT_PROOF_PHP_TEST=1"
		, "LEAN_BRIDGE_DIRECT_PROOF_PHP_ROUTES"
		, "LEAN_BRIDGE_DIRECT_PROOF_PHP_OUTPUT"
		, "for route in ordinary reviewed"
		, "check-direct-proof-erasure-php-ci.mjs"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error/u);
	const installed = await readFile(
		"tests/direct-proof-erasure-php-installed.test.mjs", "utf8");
	assert.match(installed, /assertDirectProofErasurePhpComponents/u);
	assert.match(installed, /retainDirectProofErasurePhpComponents/u);
	assert.doesNotMatch(installed, /join\(outputRoot, "bundle"\)/u);
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const required of [
		"id: direct_proof_php"
		, "bash scripts/run-direct-proof-erasure-php-ci.sh"
		, "name: direct-proof-erasure-php-${{ github.sha }}"
		, "steps.direct_proof_php.outcome != 'success'"
	]) assert.ok(workflow.includes(required), required);
});
