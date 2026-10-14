/**
 * Authenticate original installed nominal browser evidence and reject changed claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { nominalSubtypeBrowserRecords, checkNominalSubtypeBrowserReport } from "./nominal-subtype-browser-report.mjs";
import { nominalSubtypeBrowserHandoffRecords } from "./nominal-subtype-browser-package.mjs";
import { nominalSubtypeBrowserSelections, assertNominalSubtypeBrowserRun } from "./nominal-subtype-browser-provenance.mjs";
import { nominalSubtypeBrowserOriginal, nominalSubtypeBrowserSnapshot, nominalSubtypeBrowserGeneratorClosure } from "./nominal-subtype-browser-sources.mjs";
import { checkNominalSubtypeBrowserControls } from "./nominal-subtype-browser-controls.mjs";

const root = "docs/evidence/nominal-subtype-browser-20261014";
const indexSha256 = "bc4f0403b5ab7faa2fe6ad0a3df7755bba4e24bbf0127fd95df1ce66348b6c4a";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-browser-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypeBrowserSelections);
	for(const file of index.files)
	{
		assert.ok(/^[A-Za-z0-9_@.$/+-]+$/u.test(file.path) && !file.path.startsWith("/") && file.path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!files.has(file.path)); const value = await read(file.path);
		assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256); files.set(file.path, value);
	}
	return { index, files };
};
const load = () => checkArchive(path => readFile(`${root}/${path}`));
const selectionFiles = (files, run) => {
	const prefix = `${run.label}/records/`;
	return new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
};

test("nominal browser archive authenticates four installed selections, 48 browser executions and 204 lifecycle observations", async () => {
	assert.ok((await readFile("tests/helpers/nominal-subtype-browser-tests.mjs", "utf8")).includes('import "./nominal-subtype-browser-evidence-tests.mjs";'));
	const { index, files } = await load();
	assert.deepEqual(await nativeArtifactPaths(root), [...files.keys(), "index.json"].sort());
	const snapshot = nominalSubtypeBrowserSnapshot(index.producerCommit);
	assert.equal(index.sourceSnapshotCount, Object.keys(snapshot).length);
	assert.deepEqual(index.generatorClosure, nominalSubtypeBrowserGeneratorClosure(index.producerCommit));
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	for(const path of index.selectedSources)
	{
		assert.deepEqual(files.get("sources/" + path), nominalSubtypeBrowserOriginal(index.producerCommit, path));
		assert.equal(snapshot[path], sha256(files.get("sources/" + path)));
	}
	for(const path of index.checkers)
	{
		const expected = sha256(files.get("checkers/" + path));
		assert.equal(sha256(beforeFinRefinementSource(path, await readFile(path), expected)), expected);
	}
	let previousEnd = 0, nodeExecutions = 0, browserExecutions = 0, lifecycleObservations = 0, checks = 0, rejections = 0;
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		const originals = selectionFiles(files, run), npm = JSON.parse(originals.get("report.json"));
		const records = [...nominalSubtypeBrowserRecords(run.mode), ...nominalSubtypeBrowserHandoffRecords(npm.receipt)].sort();
		assert.deepEqual([...originals.keys()].sort(), records); assert.deepEqual(run.records, records);
		const checked = await checkNominalSubtypeBrowserReport(async path => originals.get(path), run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		assert.equal(run.reportSha256, sha256(originals.get("report.json"))); assert.equal(run.browserSha256, sha256(originals.get("browser.json")));
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`)), tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(sha256(tap), run.tapSha256);
		assert.deepEqual(start.sources, snapshot);
		assertNominalSubtypeBrowserRun({ ...run, start, end, tap, runner: files.get("runner.mjs") });
		assert.ok(Date.parse(start.started) >= previousEnd); previousEnd = Date.parse(end.finished);
		const report = JSON.parse(originals.get("browser.json"));
		assert.deepEqual(Object.keys(run.browserVersions).sort(), ["chromium", "firefox", "webkit"]);
		for(const profile of report.reports) for(const execution of profile.browser.executions)
			assert.equal(run.browserVersions[execution.engine], execution.observation.hostVersion);
		nodeExecutions += checked.nodeExecutions; browserExecutions += checked.browserExecutions;
		lifecycleObservations += checked.lifecycleObservations;
		checks += checked.checks * (checked.nodeExecutions + checked.lifecycleObservations);
		rejections += checked.rejections * (checked.nodeExecutions + checked.lifecycleObservations);
	}
	assert.equal(nodeExecutions, 8); assert.equal(browserExecutions, 48); assert.equal(lifecycleObservations, 204);
	assert.equal(checks, 556500); assert.equal(rejections, 109392);
});

test("nominal browser archive refuses each missing or corrupted index and original", async t => {
	const { files } = await load(); files.set("index.json", await readFile(`${root}/index.json`));
	for(const target of files.keys())
	{
		await assert.rejects(checkArchive(async path => { assert.notEqual(path, target, "Missing original"); return files.get(path); }));
		await assert.rejects(checkArchive(async path => path === target ? Buffer.concat([files.get(path), Buffer.from("changed")]) : files.get(path)));
	}
	t.diagnostic(`${files.size * 2} missing/corrupted index and original controls`);
});

test("nominal browser archive refuses coordinated runtime, compiler, caller and lifecycle replacements", async t => {
	const { index, files } = await load();
	for(const run of index.runs)
	{
		const controls = await checkNominalSubtypeBrowserControls(selectionFiles(files, run), run);
		assert.deepEqual(controls, run.controls); assert.equal(controls.recordControls, 2 * run.records.length);
		t.diagnostic(`${run.label}: ${JSON.stringify(controls)}`);
	}
});

test("nominal browser provenance refuses changed launch identity and incomplete or appended TAP", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`)), tap = files.get(`${run.label}/run.tap`);
		const input = { ...run, start, end, tap, runner: files.get("runner.mjs") };
		for(const mutate of [
			value => { value.producerCommit = "0".repeat(40); }
			, value => { value.route = "unknown"; }, value => { value.mode = "unknown"; }
			, value => { value.runnerSha256 = "0".repeat(64); }
			, value => { value.runtime.node = "v0.0.0"; }
			, value => { value.args.push("--test-skip-pattern=.*"); }
			, value => { value.environment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS = "chromium"; }
			, value => { value.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST = "0"; }
			, value => { value.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_MODES = "unknown"; }
			, value => { value.sources["../outside"] = "0".repeat(64); }
			, value => { value.initial.freeMiB = 768; }
			, value => { value.guard.observations.pop(); }
		]) {
			const changed = structuredClone(start); mutate(changed);
			assert.throws(() => assertNominalSubtypeBrowserRun({ ...input, start: changed })); controls++;
		}
		for(const mutate of [
			value => { value.code = 1; }, value => { value.signal = "SIGTERM"; }
			, value => { value.stopReason = "disk-floor"; }
			, value => { value.changed = ["src/analyze/NativeExports.lean"]; }
			, value => { value.sourcesChecked--; }
			, value => { value.runnerUnchanged = false; }
			, value => { value.headUnchanged = false; }
			, value => { value.trackedClean = false; }
			, value => { value.minimum.freeMiB = 767; }
			, value => { value.finished = new Date(Date.parse(start.started) - 1).toISOString(); }
		]) {
			const changed = structuredClone(end); mutate(changed);
			assert.throws(() => assertNominalSubtypeBrowserRun({ ...input, end: changed })); controls++;
		}
		for(const text of [
			tap.toString().replace("# pass 1", "# pass 0")
			, tap.toString().replace("# skipped 0", "# skipped 1")
			, tap.toString().replace("ok 1 -", "not ok 1 -")
			, tap.toString().replace("1..1", "1..2")
			, tap.toString() + "incomplete\n"
			, tap.toString() + tap.toString()
			, ...["not ok 1 - hidden failure", "ok 1 - hidden pass", "# Subtest: hidden", "Bail out! stopped"]
				.map(line => tap.toString().replace("\n1..1\n", `\n    ${line}\n1..1\n`))
		]) {
			const changed = Buffer.from(text);
			assert.throws(() => assertNominalSubtypeBrowserRun({ ...input, tap: changed, end: { ...end, tapSha256: sha256(changed) } })); controls++;
		}
	}
	assert.equal(controls, 128); t.diagnostic(`${controls} coordinated provenance controls`);
});
