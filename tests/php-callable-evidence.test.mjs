/**
 * Bind native PHP callable claims to relocated Composer execution in both modes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { phpCallableConsumer, phpCallableSignatures, phpCallableRequest } from "./helpers/php-callable-fixture.mjs";
import { phpIsolationFlags } from "./helpers/type-corpus-php.mjs";

test("native PHP callable evidence binds both source paths to installed weak/strict execution", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-callables-20260919.json"));
	assert.equal(record.wordBits, 64); assert.equal(record.php, "8.2.33");
	assert.deepEqual(record.signatures, phpCallableSignatures);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash);
	for(const run of record.executions)
	{
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		for(const key of phpIsolationFlags) assert.equal(run.php[key], true, key);
		assert.equal(run.php.requestSha256, sha256(phpCallableRequest(run.path)));
		assert.deepEqual(run.php.executions.map(execution => execution.mode), ["weak", "strict"]);
		assert.equal(run.php.lock.packages.find(pkg => pkg.name === "brick/math").version, "1.0.0");
		for(const { mode, observation } of run.php.executions)
		{
			assert.equal(run.php.consumerSources[mode], sha256(phpCallableConsumer(mode, run.path)));
			assert.equal(observation.checks, 51686); assert.equal(observation.fork, true);
			assert.equal(Object.keys(observation.libraries).length, 4);
			for(const [path, hash] of Object.entries(observation.libraries))
			{
				assert.ok(path.includes("/relocated/vendor/lean-bridge-callables/api/native/linux-x64/"));
				assert.equal(hash, run.php.packageReceipt.files["native/linux-x64/" + path.split("/").at(-1)].sha256);
			}
		}
	}
	assert.equal(record.regression.passed, 4);
	assert.deepEqual(record.regression.projects.map(project => project.project), ["Clover", "Juniper"]);
	for(const corpus of record.corpora)
	{
		assert.match(corpus.sha256, /^[a-f0-9]{64}$/); assert.equal(corpus.runs.length, 2);
		assert.equal(corpus.summary.executedCases, 124); assert.equal(corpus.summary.compileRejectedCases, 0);
		for(const run of corpus.runs)
		{
			assert.equal(run.php.offline, true);
			assert.equal(run.php.compilerFreeExecution, true);
		}
	}
});
