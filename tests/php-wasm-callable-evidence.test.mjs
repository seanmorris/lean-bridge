/**
 * Bind wasm32 callable coverage to installed PHP execution in both source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { phpCallableSignatures } from "./helpers/php-callable-fixture.mjs";
import { beforePhpWasmStructuredCallables } from "./helpers/php-wasm-structured-callable-source-history.mjs";

test("PHP-Wasm callable evidence binds exact signatures to all installed arrangements", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-wasm-callables-20260919.json"));
	assert.equal(record.wordBits, 32); assert.equal(record.php, "8.4.1");
	assert.equal(record.phpWasm, "0.1.0"); assert.equal(record.emscripten, "3.1.68");
	assert.deepEqual(record.signatures, phpCallableSignatures);
	for(const [path, hash] of Object.entries(record.sourceHashes))
		assert.equal(sha256(beforePhpWasmStructuredCallables(path, await readFile(path, "utf8"), hash)), hash, path);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const arrangements = new Set(["node/embedded", "node/composer", "chromium/bundled"].flatMap(host =>
		["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => `${host}/${loading}/${mode}`))));
	const fixture = await readFile("tests/fixtures/callable-consumers/php-wasm.php", "utf8");
	for(const run of record.executions)
	{
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "driverSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/u);
		assert.equal(run.consumerSha256, sha256(fixture.replace("require 'vendor/autoload.php';", "")
			.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${run.path === "reviewed-ir" ? "value" : "arg"}';`)));
		assert.equal(run.executions.length, 12);
		assert.deepEqual(new Set(run.executions.map(e => `${e.realm}/${e.arrangement}/${e.loading}/${e.mode}`)), arrangements);
		for(const execution of run.executions)
		{
			assert.equal(execution.checks, 79934); assert.equal(execution.libraries, 2);
			assert.equal(execution.bailoutRecovery, true);
		}
		assert.deepEqual(new Set(run.packages.map(pkg => `${pkg.ecosystem}/${pkg.role}`)), new Set(["composer/api", "npm/component", "npm/runtime"]));
		assert.equal(new Set(run.packages.map(pkg => pkg.runtimeIdentity)).size, 1);
		for(const pkg of run.packages) for(const artifact of pkg.artifacts) assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.equal(record.regression.passed, 5);
	assert.equal(record.regression.nativePhp.passed, 1); assert.equal(record.regression.copiedZend.passed, 2);
	assert.deepEqual(record.regression.projects.map(project => [project.project, project.exports]), [["Willow", 46], ["Aspen", 46]]);
	for(const corpus of record.corpora)
	{
		assert.match(corpus.sha256, /^[a-f0-9]{64}$/u);
		assert.equal(corpus.summary.executedCases, 124); assert.equal(corpus.summary.unsupportedCases, 0);
		assert.equal(corpus.runs.length, 2);
		for(const run of corpus.runs)
		{
			assert.equal(run.independentBuilds, 2);
			for(const key of ["compilerFreeExecution", "offlineInstall", "relocated", "repeatExecution", "unchangedDeployment"]) assert.equal(run.phpWasm[key], true, key);
			assert.equal(run.phpWasm.brickMath.version, "1.0.0");
			assert.deepEqual(new Set(run.phpWasm.executions.map(e => `${e.realm}/${e.arrangement}/${e.loading}/${e.mode}`)), arrangements);
		}
	}
});
