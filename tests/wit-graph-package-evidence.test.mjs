/**
 * Retain original WIT package executions and fail closed on weakened evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertWitPackageReports, assertWitPackageExecution, assertWitPackageIntegration, assertWitPackageRegressions, beforeWitPackageInventory, witPackageExecutionPath, witPackageRegressionPath } from "./helpers/wit-package-evidence.mjs";
import { beforeWitPackageIntegration, reverseWitPackageUpdate, witPackageHistoryPath } from "./helpers/wit-package-source-history.mjs";
import { beforeWitHostIntegration } from "./helpers/wit-host-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("recursive WIT execution retains both installed archives, owned results and repeat builds", async () => {
	await assertWitPackageExecution(await json(witPackageExecutionPath));
});

test("recursive WIT evidence rejects weakened observations even after their hashes are recomputed", async () => {
	const original = await json(witPackageExecutionPath);
	for(const change of [
		record => { record.finalAcceptance = true; }
		, record => { delete record.sourceHashes["src/build/native-project.mjs"]; }
		, record => { record.reports.installed.observations.pop(); }
		, record => { record.reports.reproduction.observations[0].originalArchiveSha256 = "0".repeat(64); }
		, record => { record.reports.installed.observations[0].rejectsRegeneratedSourceDrift = 0; }
		, record => { record.reports.installed.observations[0].installed.nodelete = false; }
		, record => { record.reports.installed.observations[0].installed.observations[0].lifetime.cleanupAfterDlclose = false; }
		, record => { record.reports.installed.observations[0].installed.observations.pop(); }
		, record => { record.reports.installed.observations[0].installed.faults.malformed.twoSessionsRejected = false; }
		, record => { record.reports.installed.observations[0].installed.faults.limit.twoSessionsUsable = false; }
		, record => { record.reports.installed.observations[0].installed.documents[1].shapes[0][0].arity++; }
		, record => { record.reports.installed.observations[0].installed.packageReceipt.files["lib/librecursive_wasmtime.so"].sha256 = "0".repeat(64); }
		, record => { delete record.reports.installed.observations[0].installed.probes["result-fault.so"]; }
		, record => { record.reports.sanitizers.observation.liveAllocations++; }
		, record => { record.logs.installed.text = record.logs.installed.text.replace("# skipped 1", "# skipped 2"); }
	]) {
		const changed = structuredClone(original); change(changed);
		for(const [name, report] of Object.entries(changed.reports)) changed.reportHashes[name] = sha256(canonicalJson(report));
		for(const log of Object.values(changed.logs)) log.sha256 = sha256(log.text);
		assert.throws(() => assertWitPackageReports(changed));
	}
});

test("WIT package integration reconstructs entire predecessors without hiding unrelated edits", async () => {
	const record = await json(witPackageHistoryPath);
	for(const path of [...new Set(record.updates.map(update => update.path))])
	{
		const current = beforeWitHostIntegration(path, await readFile(path, "utf8"));
		let source = current;
		for(const update of record.updates.filter(update => update.path === path).toReversed())
		{
			assert.throws(() => reverseWitPackageUpdate(source + "\n// unrelated edit\n", update));
			assert.throws(() => reverseWitPackageUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
			assert.throws(() => reverseWitPackageUpdate(source, { ...update, edits: [] }));
			assert.throws(() => reverseWitPackageUpdate(source, { ...update, path: "src/analyze/binding-ir.mjs" }));
			source = reverseWitPackageUpdate(source, update);
			assert.equal(sha256(beforeWitPackageIntegration(path, current, update.previousSha256)), update.previousSha256);
			assert.notEqual(sha256(beforeWitPackageIntegration(path, current + "\n// unrelated edit\n", update.previousSha256)), update.previousSha256);
		}
		assert.equal(beforeWitPackageIntegration(path, current), source);
		if(path === "docs/consume/wit-wasi.md")
			assert.deepEqual(current.match(/^```[^\n]*\n[\s\S]*?^```/gm), source.match(/^```[^\n]*\n[\s\S]*?^```/gm), "Existing executed documentation examples stay unchanged");
	}
	assert.equal(beforeWitPackageIntegration("src/analyze/binding-ir.mjs", "unrelated"), "unrelated");
});

test("current WIT package integration binds fresh shared-backend regressions and exact source changes", async () => {
	await assertWitPackageIntegration(await json(witPackageHistoryPath));
});

test("WIT inventory refresh changes source digests without widening installed acceptance", async () => {
	const record = await json(witPackageHistoryPath), source = await readFile(record.inventory.path, "utf8");
	beforeWitPackageInventory(source, record.inventory, record.updates);
	assert.throws(() => beforeWitPackageInventory(source + "\n", record.inventory, record.updates));
	const changed = source.replace('"contractVersion": "0.84.0"', '"contractVersion": "1.0.0"');
	assert.throws(() => beforeWitPackageInventory(changed, { ...record.inventory, currentSha256: sha256(changed) }, record.updates));
	for(const mutate of [
		value => { value.entries.pop(); }
		, value => { value.entries[0].previousSha256 = "0".repeat(64); }
		, value => { value.entries[0].occurrences++; }
		, value => { value.entries.push(value.entries[0]); }
	]) {
		const bad = structuredClone(record.inventory); mutate(bad);
		assert.throws(() => beforeWitPackageInventory(source, bad, record.updates));
	}
});

test("WIT package regression evidence rejects missing gates, stale artifacts and weaker checks", async () => {
	const original = await json(witPackageRegressionPath);
	for(const change of [
		record => { delete record.native.perl; }
		, record => { record.native.c.executions[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
		, record => { record.native.python.executions.pop(); }
		, record => { record.wit.collections.report.reports.pop(); }
		, record => { record.wit.collections.report.reports[0].wit.packageReceipt.files["lib/libcollections_wasmtime.so"].sha256 = "0".repeat(64); }
		, record => { record.wit.callables.report.reports[0].compilerFreePath = false; }
		, record => { record.wit.callables.log.text = record.wit.callables.log.text.replace("# skipped 0", "# skipped 1"); }
		, record => { record.finalAcceptance = true; }
	]) {
		const changed = structuredClone(original); change(changed);
		for(const run of Object.values(changed.native))
		{
			run.observationsSha256 = sha256(canonicalJson(run.executions ?? run.report)); run.log.sha256 = sha256(run.log.text);
		}
		for(const run of Object.values(changed.wit))
		{ run.reportSha256 = sha256(canonicalJson(run.report)); run.log.sha256 = sha256(run.log.text); }
		await assert.rejects(() => assertWitPackageRegressions(changed));
	}
});

test("downstream CI executes and uploads every recursive WIT package gate", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const recorded = workflow.split("\n").find(line => line.includes("record --consumer wit-wasi"));
	for(const [flag, file] of [["TEST", "conversions"], ["NATIVE_TEST", "native"], ["INSTALLED_TEST", "package"], ["REPRO_TEST", "package"]])
	{
		const command = `LEAN_BRIDGE_WIT_GRAPH_${flag}=1 node --test tests/wit-copied-graph-${file}.test.mjs`;
		assert.ok(workflow.includes(`          ${command}\n`)); assert.ok(recorded.includes(command));
	}
	for(const path of ["recursive-wit/conversions", "recursive-wit/native", "recursive/wit-packages", "recursive/wit-reproducibility"])
	{
		assert.ok(workflow.includes(`          test -s build/${path}.json\n`));
		assert.ok(workflow.includes(`            build/${path}.json\n`));
	}
});
