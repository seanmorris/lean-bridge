/**
 * Require original installed JVM archives and exact source transitions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertJvmStructuredCallableExecution, assertJvmStructuredCallableIntegration, jvmStructuredCallableExecutionPath } from "./helpers/jvm-structured-callable-evidence.mjs";
import { beforeJvmStructuredCallables, jvmStructuredCallableHistoryPath, reverseJvmStructuredCallableUpdate } from "./helpers/jvm-structured-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("JVM structured acceptance binds original Maven archives and preserves predecessor receipts", async () => {
	await assertJvmStructuredCallableIntegration(await json(jvmStructuredCallableHistoryPath));
});

test("JVM structured execution rejects missing paths, failures, types and documentation", async () => {
	const original = await json(jvmStructuredCallableExecutionPath);
	await assertJvmStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("ruby"); }
		, record => { record.scope.recursiveCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.reports.pop(); }
		, record => { record.reports[0].signatures.pop(); }
		, record => { record.reports[0].jvm.runtimeModules.push("jdk.compiler"); }
		, record => { record.reports[0].jvm.inspection.runs.pop(); }
		, record => { record.reports[0].jvm.inspection.runs[0].liveHosts = 1; }
		, record => { record.reports[0].jvm.inspection.runs[1].faults = 0; }
		, record => { record.reports[0].jvm.inspection.isolatedInstrumentedProjection = false; }
		, record => { record.reports[1].jvm.handoffRemovedBeforeExecution = false; }
		, record => { record.reports[0].jvm.installedSourcesRemoved = false; }
		, record => { record.reports[0].observation.results.pop(); }
		, record => { record.reports[0].observation.results[3].diagnostics[0].code = "wrong"; }
		, record => { record.reports[0].jvm.deployment["package.jar"].sha256 = "0".repeat(64); }
		, record => { record.reports[0].jvm.documentation[0].runtimeOnlyExecution = false; }
		, record => { record.reports[1].jvm.documentation[0].sourceSha256 = "0".repeat(64); }
		, record => { record.primitiveReports.pop(); }
		, record => { record.installed.text = record.installed.text.replace("# skipped 0", "# skipped 1"); record.installed.sha256 = sha256(record.installed.text); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertJvmStructuredCallableExecution(altered));
	}
});

test("JVM structured integration rejects changed history or extra promoted cells", async () => {
	const original = await json(jvmStructuredCallableHistoryPath);
	for(const mutate of [
		record => { record.inventory.installed++; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { record.codegen.sha256 = "0".repeat(64); }
		, record => { record.updates.pop(); }
		, record => { record.sourceHashes["src/backends/jvm/copied-model.mjs"] = "0".repeat(64); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertJvmStructuredCallableIntegration(altered));
	}
});

test("JVM structured source history preserves unrelated source drift", async () => {
	const record = await json(jvmStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseJvmStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeJvmStructuredCallables(update.path, source)), update.previousSha256);
		assert.notEqual(sha256(beforeJvmStructuredCallables(update.path, source + "\n// unrelated\n")), update.previousSha256);
		assert.throws(() => reverseJvmStructuredCallableUpdate(source + "\n// unrelated\n", update));
	}
});
