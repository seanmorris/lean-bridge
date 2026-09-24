/**
 * Reject missing isolation cases, rewritten receipts and unmeasured source drift.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertWitHostIsolation, assertWitHostExecution, assertWitHostIntegration, witHostExecutionPath } from "./helpers/wit-host-evidence.mjs";
import { beforeWitHostIntegration, reverseWitHostUpdate, reverseWitHostInventory, witHostHistoryPath } from "./helpers/wit-host-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("WIT source reversal treats replacement tokens as literal source bytes", () => {
	const previous = 'const tokens = "$& $$ $` $\'";\n', current = '// new guard\n' + previous;
	const update = { path: "src/release/native-wasi.mjs"
		, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits: [{ previous, current }] };
	assert.equal(reverseWitHostUpdate(current, update), previous);
});

test("WIT host isolation retains actual conflicting and compatible installed executions", async () => {
	await assertWitHostExecution(await json(witHostExecutionPath));
});

test("WIT host isolation rejects omitted modes, wrong results and bypassed dependency checks", async () => {
	const original = (await json(witHostExecutionPath)).reports.isolation;
	for(const mutate of [
		report => { report.results.pop(); }
		, report => { report.results[0].observation.secondRejected = false; }
		, report => { report.results[0].observation.firstAfter = 0; }
		, report => { report.results[0].observation.inheritedHostRejected = false; }
		, report => { report.results[2].observation.second = 21; }
		, report => { report.results[0].visibility = "global"; }
		, report => { report.packages[1].component.nativeLibrary = report.packages[0].component.nativeLibrary; }
		, report => { report.sourceFree = false; }
	]) {
		const bad = structuredClone(original); mutate(bad); assert.throws(() => assertWitHostIsolation(bad));
	}
});

test("WIT host evidence rejects weakened fresh reports after recomputing their digests", async () => {
	const original = await json(witHostExecutionPath);
	for(const mutate of [
		record => { record.finalAcceptance = true; }
		, record => { record.originalFailure.report.results[2].observation.second = 21; }
		, record => { record.reports.hash.checks--; }
		, record => { record.reports.callables.reports.pop(); }
		, record => { record.reports.collections.reports[0].wit.compilerFreeExecution = false; }
		, record => { record.reports.recursive.observations[0].installed.nodelete = false; }
		, record => { record.reports.reproduction.observations[0].reproducedOriginalArchive = false; }
		, record => { record.logs.isolation.text = record.logs.isolation.text.replace("# skipped 0", "# skipped 1"); }
	]) {
		const bad = structuredClone(original); mutate(bad);
		for(const [name, report] of Object.entries(bad.reports)) bad.reportHashes[name] = sha256(canonicalJson(report));
		for(const log of Object.values(bad.logs)) log.sha256 = sha256(log.text);
		await assert.rejects(() => assertWitHostExecution(bad));
	}
});

test("WIT host lineage preserves full predecessor sources and inventory support claims", async () => {
	const record = await json(witHostHistoryPath);
	await assertWitHostIntegration(record);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(beforeWitHostIntegration(update.path, source)), update.previousSha256);
		assert.equal(sha256(reverseWitHostUpdate(source, update)), update.previousSha256);
		assert.throws(() => reverseWitHostUpdate(source + "\n// unrelated edit\n", update));
		assert.throws(() => reverseWitHostUpdate(source, { ...update, edits: [] }));
		assert.notEqual(sha256(beforeWitHostIntegration(update.path, source + "\n// unrelated edit\n")), update.previousSha256);
	}
	const inventory = await readFile(record.inventory.path, "utf8");
	assert.throws(() => reverseWitHostInventory(inventory + "\n", record.inventory));
	const changed = inventory.replace('"contractVersion": "0.84.0"', '"contractVersion": "1.0.0"');
	assert.throws(() => reverseWitHostInventory(changed, { ...record.inventory, currentSha256: sha256(changed) }));
	const incorrectCount = structuredClone(record.inventory); incorrectCount.entries[0].occurrences++;
	assert.throws(() => reverseWitHostInventory(inventory, incorrectCount));
});

test("downstream CI executes and retains the installed WIT isolation and sanitizer gates", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const recorded = workflow.split("\n").find(line => line.includes("record --consumer wit-wasi"));
	for(const [flag, file] of [["LEAN_BRIDGE_WIT_HOST_TEST", "wit-host-evidence"], ["LEAN_BRIDGE_WIT_HOST_PACKAGES_TEST", "wit-host-packages"]])
	{
		const command = `${flag}=1 node --test tests/${file}.test.mjs`;
		assert.ok(workflow.includes(`          ${command}\n`)); assert.ok(recorded.includes(command));
	}
	for(const name of ["host-hash", "host-isolation"])
	{
		assert.ok(workflow.includes(`          test -s build/recursive-wit/${name}.json\n`));
		assert.ok(workflow.includes(`            build/recursive-wit/${name}.json\n`));
	}
});
