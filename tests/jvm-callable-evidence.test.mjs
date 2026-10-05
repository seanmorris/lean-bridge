/**
 * Bind JVM callable claims to independently compiled and relocated installed consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { jvmCallableConsumer, jvmCallableSignatures, jvmCallableRejections } from "./helpers/jvm-callable-fixture.mjs";
import { assertJvmHistoricalSource, readJvmHistoricalEvidence } from "./helpers/jvm-source-history.mjs";

test("JVM callable evidence binds both languages and source paths to runtime-only installations", async () => {
	const record = await readJvmHistoricalEvidence("jvm-callables-20260919");
	assert.equal(record.wordBits, 64); assert.equal(record.jdk, "22.0.2"); assert.equal(record.kotlin, "2.2.0");
	assert.deepEqual(record.signatures, jvmCallableSignatures);
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/java", "ordinary-source/kotlin", "reviewed-ir/java", "reviewed-ir/kotlin"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertJvmHistoricalSource("jvm-callables-20260919", path, hash);
	for(const run of record.executions)
	{
		assert.equal(run.checks, run.profile === "java" ? 66683 : 66655);
		assert.equal(record.consumerHashes[run.profile], sha256(jvmCallableConsumer(run.profile)));
		assert.equal(run.jvm.consumerSourceSha256, record.consumerHashes[run.profile]);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		for(const key of ["offline", "emptyRepository", "emptyUserHome", "resolvedClasspathOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries"]) assert.equal(run.jvm[key], true, key);
		assert.deepEqual(run.jvm.runtimeModules, ["java.base@22.0.2"]);
		assert.equal(run.jvm.deployment["package.jar"].sha256, run.jvm.archiveSha256);
		const expected = jvmCallableRejections(run.profile);
		assert.deepEqual(run.rejected.map(result => result.id), expected.map(result => result.id));
		for(const [i, result] of run.rejected.entries())
		{
			assert.equal(result.sourceSha256, sha256(expected[i].source));
			assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code), [expected[i].expectation.diagnostic].flat());
		}
	}
	assert.equal(record.regression.passed, 4);
	assert.deepEqual(record.regression.projects.map(project => project.project), ["Maple", "Cedar"]);
	for(const corpus of record.corpora)
	{
		assert.match(corpus.sha256, /^[a-f0-9]{64}$/); assert.equal(corpus.runs.length, 4);
		assert.equal(corpus.summary.executedCases, 204); assert.equal(corpus.summary.compileRejectedCases, 44);
		for(const run of corpus.runs)
		{
			assert.equal(run.jvm.offline, true);
			assert.equal(run.jvm.runtimeOnlyExecution, true);
		}
	}
});
