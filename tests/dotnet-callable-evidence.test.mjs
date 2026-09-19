/**
 * Bind .NET callable claims to exact installed and runtime-only acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { dotnetCallableConsumer, dotnetCallableSignatures } from "./helpers/dotnet-callable-fixture.mjs";

test(".NET callable evidence preserves both source paths, signatures and runtime-only results", async () => {
	const record = JSON.parse(await readFile("docs/evidence/dotnet-callables-20260919.json"));
	assert.equal(record.consumerSha256, sha256(dotnetCallableConsumer()));
	assert.deepEqual(record.signatures, dotnetCallableSignatures);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "dotnet"); assert.equal(run.checks, 128247);
		assert.equal(run.consumerSha256, record.consumerSha256);
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		const installed = run.installed;
		assert.equal(installed.onlyPreparedDependency, true); assert.equal(installed.sourceFree, true);
		assert.equal(installed.sourceFreeExecutions, 2); assert.equal(installed.sourceFreeChecks, run.checks);
		assert.equal(installed.sdk, "8.0.424");
		assert.equal(installed.deployment["LeanBridge.Callables.dll"].sha256, installed.assemblySha256);
		assert.deepEqual(installed.rejected.map(result => result.name), ["callback-result", "callback-width", "async-result", "unit-result", "closure-signature", "closure-argument", "closure-constructor"]);
		for(const result of installed.rejected) assert.ok(result.codes.every(code => /^CS\d+$/.test(code)));
		for(const pkg of run.packages) for(const archive of pkg.artifacts) assert.match(archive.sha256, /^[a-f0-9]{64}$/);
	}
	assert.equal(record.regression.passed, 4);
	assert.deepEqual(record.regression.projects.map(project => project.project), ["Aurora", "Boreal"]);
	for(const corpus of record.corpora)
	{
		assert.match(corpus.sha256, /^[a-f0-9]{64}$/); assert.equal(corpus.runs.length, 2);
		for(const run of corpus.runs)
		{
			assert.equal(run.profile, "dotnet");
			assert.deepEqual(run.counts, { matched: 44, "rejected-as-expected": 2, "rejected-at-compile-time": 16 });
			assert.equal(run.dotnet.offline, true); assert.equal(run.dotnet.installedSourcesRemoved, true);
		}
	}
});
