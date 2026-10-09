/**
 * Keep the local reviewed Fin Wasm entry measurements bound to every attempt, its exact transcripts, frozen
 * expectations and producer sources, in both modes, both routes, both selections and every declared context (VO #1438).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import { sha256 } from "../src/capsule/node.mjs";
import { assertWasmEntryArchive, assertWasmEntryAttempt, recountArchivedWasmEntryReport, wasmEntryAttempts, wasmEntryCase, wasmEntryDirectory, wasmEntryEngines, wasmEntryPaths, wasmEntryRuns } from "./helpers/wasm-entry-evidence.mjs";

const receiptSha256 = "04e06f2615e9c3de7e4609b2939cc89c3f0a2795603cd4f12502bf767d85119b";
const receipt = async () => {
	const bytes = await readFile(`${wasmEntryDirectory}/receipt.json`);
	assert.equal(sha256(bytes), receiptSha256);
	return JSON.parse(bytes);
};
const member = async name => {
	const bytes = await readFile(`${wasmEntryDirectory}/${name}`);
	return (name.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8");
};
const frozen = async () => ({
	expectations: Object.fromEntries(await Promise.all(["original-scalar", "original-structural", "probe-scalar", "probe-structural"].map(async key => [key, JSON.parse(await member(`expectations/${key}.json.gz`))])))
	, typescript: { scalar: await member("typescript/scalar.ts.txt"), structural: await member("typescript/structural.ts.txt") }
});
const attempt = id => wasmEntryAttempts.find(item => item.id === id);
const records = async id => {
	const reports = {};
	for(const name of attempt(id).reports) reports[name] = JSON.parse(await member(`${id}/${name}.json.gz`));
	const json = async name => JSON.parse(await member(`${id}/${name}`));
	return { queue: await json("queue.json"), start: await json("start.json"), end: await json("end.json"), tap: await member(`${id}/run.tap`), runner: await member(`${id}/runner.mjs.txt`), reports };
};
const refuses = async (id, mutations) => {
	const original = await records(id), expected = await frozen();
	assertWasmEntryAttempt(attempt(id), original, expected);
	for(const [index, mutate] of mutations.entries())
	{
		const value = structuredClone(original); mutate(value);
		assert.throws(() => assertWasmEntryAttempt(attempt(id), value, expected), assert.AssertionError, `${id} mutation ${index}`);
	}
};

test("the Wasm entry archive recounts all eight cases in Node and every browser context from exact originals", async () => {
	const value = await receipt();
	const { runs } = await assertWasmEntryArchive(value);
	assert.equal(runs, 440);
	assert.deepEqual([wasmEntryRuns([]), wasmEntryRuns(wasmEntryEngines)], [2, 53]);
	assert.deepEqual(value.artifacts.map(file => file.path), wasmEntryPaths);
	assert.deepEqual(value.attempts.map(item => [item.id, item.outcome]), wasmEntryAttempts.map(item => [item.id, item.outcome]));
	assert.deepEqual([value.scope.local, value.scope.hostedCi, value.scope.lockedNix, value.scope.supportPromotion, value.scope.cases], [true, false, false, false, 8]);
	assert.deepEqual(value.scope.failedAttempts.map(item => item.id), ["failed-ba282ec-node-smoke"]);
	// Reports and expectations are compressed; every other member is the original bytes.
	for(const file of value.artifacts) assert.equal(file.path.endsWith(".gz"), file.path.endsWith(".json.gz") && file.sha256 !== file.originalSha256, file.path);
});

test("archive bytes refuse a changed, swapped, truncated or oversized member before any record is read", async () => {
	const value = await receipt(), bytesOnly = { currentSources: false };
	const report = `${wasmEntryDirectory}/node-7eae444/probe-reviewed-scalar.json.gz`, tap = `${wasmEntryDirectory}/node-7eae444/run.tap`;
	const swap = (path, change) => async name => name === path ? change(await readFile(name)) : readFile(name);
	const original = gunzipSync(await readFile(report));
	for(const read of [
		swap(tap, bytes => Buffer.concat([bytes, Buffer.from("\n")]))
		, swap(report, bytes => { const copy = Buffer.from(bytes); copy[copy.length - 9] ^= 1; return copy; })
		, swap(report, () => gzipSync(Buffer.from(original.toString("utf8").replace("\"reproducible\":true", "\"reproducible\":false"))))
		, swap(report, () => readFile(`${wasmEntryDirectory}/node-7eae444/probe-ordinary-structural.json.gz`))
		, swap(report, bytes => bytes.subarray(0, bytes.length - 1))])
		await assert.rejects(assertWasmEntryArchive(value, read, bytesOnly));
	// A receipt that declares a larger original cannot make the reader inflate past it.
	const inflated = structuredClone(value);
	inflated.artifacts.find(file => file.path === report).originalBytes -= 1;
	await assert.rejects(assertWasmEntryArchive(inflated, readFile, bytesOnly));
	for(const changed of [{ ...value, artifacts: value.artifacts.slice(1) }, { ...value, artifacts: [...value.artifacts, value.artifacts[0]] }, { ...value, scope: { ...value.scope, hostedCi: true } }])
		await assert.rejects(assertWasmEntryArchive(changed, readFile, bytesOnly));
});

test("Node reports refuse changed modes, routes, transcripts, preludes, contexts and counts", () => refuses("node-7eae444", [
	value => { value.reports["probe-reviewed-scalar"].mode = "original"; }
	, value => { value.reports["original-ordinary-structural"].path = "reviewed-ir"; }
	, value => { const report = value.reports["original-reviewed-scalar"]; const [digest] = Object.keys(report.transcripts); report.transcripts[digest] = `${report.transcripts[digest]} `; }
	, value => { const report = value.reports["original-reviewed-scalar"]; delete report.transcripts[Object.keys(report.transcripts)[1]]; }
	, value => { value.reports["probe-reviewed-structural"].contexts[1].prelude = ["mirror", "label"]; }
	, value => { value.reports["probe-reviewed-structural"].contexts.pop(); }
	, value => { value.reports["original-reviewed-scalar"].contexts[0].calls += 1; }
	, value => { value.reports["probe-ordinary-structural"].typescriptSha256 = "0".repeat(64); }
	, value => { delete value.reports["probe-ordinary-structural"].instrumentation; }
	, value => { value.reports["original-reviewed-scalar"].instrumentation = "probe build"; }
	, value => { value.reports["original-reviewed-scalar"].sourceRemovedBeforeInstallation = false; }
	, value => { value.end.code = 1; }
	, value => { value.tap = value.tap.replace("# skipped 0", "# skipped 1"); }
	, value => { value.queue.sources["tests/reviewed-fin-wasm-entry.test.mjs"] = "0".repeat(64); }
	, value => { value.queue.scope = value.queue.scope.replace("not locked Nix or hosted acceptance", "hosted acceptance"); }
	, value => { value.runner += "\n"; }
]));

test("browser reports refuse a missing engine, phase, variant or execution and an unretained transcript", () => refuses("browser-scalar-7eae444", [
	value => { value.reports["original-ordinary-scalar"].contexts[2].engines = ["chromium", "firefox"]; }
	, value => { value.reports["original-ordinary-scalar"].contexts[3].observations.pop(); }
	, value => { value.reports["probe-ordinary-scalar"].contexts[3].observations[5].variant = "production"; }
	, value => { value.reports["probe-ordinary-scalar"].contexts[4].executions.pop(); }
	, value => { const context = value.reports["probe-ordinary-scalar"].contexts[4], [first] = context.executions; first.transcriptSha256 = context.observations.find(item => item.transcriptSha256 !== first.transcriptSha256).transcriptSha256; }
	, value => { const report = value.reports["original-ordinary-scalar"]; delete report.transcripts[report.contexts[2].observations[0].transcriptSha256]; }
	, value => { value.reports["original-ordinary-scalar"].contexts.splice(3, 1); }
	, value => { value.queue.requiredEngines = ["chromium", "firefox"]; }
	, value => { value.queue.browserPreflight.engines.webkit.probe = false; }
	, value => { value.queue.environment.LEAN_BRIDGE_REVIEWED_FIN_WASM_ENTRY_BROWSER_TEST = "0"; }
]));

test("the failed ba282ec smoke stays failed with its exact refused comparison and no reports", () => refuses("failed-ba282ec-node-smoke", [
	value => { value.end.code = 0; }
	, value => { value.tap = value.tap.replace("# fail 2", "# fail 1"); }
	, value => { value.tap = value.tap.replaceAll("    the private ABI is the expected contract's\n", "    another failure\n"); }
	, value => { value.reports["original-ordinary-scalar"] = {}; }
]));

test("a report recounts only against the frozen expectation of its own mode and selection, on its declared engines", async () => {
	const expected = await frozen();
	const report = JSON.parse(await member("node-smoke-7c11757/probe-ordinary-scalar.json.gz"));
	assert.equal(recountArchivedWasmEntryReport(report, expected.expectations["probe-scalar"], expected.typescript.scalar, []), 2);
	assert.throws(() => recountArchivedWasmEntryReport(report, expected.expectations["original-scalar"], expected.typescript.scalar, []));
	assert.throws(() => recountArchivedWasmEntryReport(report, expected.expectations["probe-structural"], expected.typescript.structural, []));
	assert.throws(() => recountArchivedWasmEntryReport(report, expected.expectations["probe-scalar"], `${expected.typescript.scalar}\n`, []));
	assert.throws(() => recountArchivedWasmEntryReport(report, expected.expectations["probe-scalar"], expected.typescript.scalar, wasmEntryEngines));
	assert.deepEqual(wasmEntryCase("probe-reviewed-structural"), { mode: "probe", path: "reviewed-ir", selection: "structural" });
	for(const name of ["probe-reviewed", "probe-hosted-scalar", "original-ordinary-scalar-extra", "nested-ordinary-scalar"]) assert.throws(() => wasmEntryCase(name), assert.AssertionError, name);
});
