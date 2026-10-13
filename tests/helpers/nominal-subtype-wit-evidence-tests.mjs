/**
 * Verify original nominal WIT acceptance and reject coordinated evidence mutations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { nominalSubtypeWitOriginal, nominalSubtypeWitGenerator } from "./nominal-subtype-wit-generators.mjs";
import { checkNominalSubtypeWitReport } from "./nominal-subtype-wit-report.mjs";
import { assertNominalSubtypeWitRun, nominalSubtypeWitSelections } from "./nominal-subtype-wit-provenance.mjs";
import { checkNominalSubtypeWitControls } from "./nominal-subtype-wit-controls.mjs";

const root = "docs/evidence/nominal-subtype-wit-20261013";
const indexSha256 = "760dc281a804a238af123a2b1e1a4d5f3acdbacf6598b6518fb2922fcfec2e2e";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-wit-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypeWitSelections);
	for(const file of index.files)
	{
		assert.ok(/^[A-Za-z0-9_.$/-]+$/u.test(file.path) && file.path.split("/").every(part => part && part !== "." && part !== ".."));
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

test("nominal WIT archive authenticates four packages and eight relocated executions", async () => {
	assert.ok((await readFile("tests/helpers/nominal-subtype-wit-tests.mjs", "utf8")).includes('import "./nominal-subtype-wit-evidence-tests.mjs";'));
	const { index, files } = await load();
	assert.deepEqual(await nativeArtifactPaths(root), [...files.keys(), "index.json"].sort());
	for(const path of index.selectedSources) assert.deepEqual(files.get("sources/" + path), nominalSubtypeWitOriginal(index.producerCommit, path));
	assert.deepEqual(index.generatorClosure, (await nominalSubtypeWitGenerator(index.producerCommit)).paths);
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	for(const name of index.checkers)
	{
		const path = `tests/helpers/nominal-subtype-wit-${name}.mjs`, expected = sha256(files.get(`checkers/${name}.mjs`));
		assert.equal(sha256(beforeFinRefinementSource(path, await readFile(path), expected)), expected);
	}
	let executions = 0, checks = 0, rejections = 0, hostRejections = 0, snapshotControls = 0;
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		assert.equal(run.wasmtime, "42.0.1"); assert.equal(run.nativeHostRequired, true); assert.equal(run.standaloneWasi, false);
		const originals = selectionFiles(files, run); assert.deepEqual([...originals.keys()].sort(), run.records);
		const checked = await checkNominalSubtypeWitReport(async path => originals.get(path), run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		const start = JSON.parse(files.get(`${run.label}/start.json`));
		const ends = JSON.parse(files.get(`${run.label}/runs.json`)), end = ends.find(item => item.selection === `${run.route}/${run.mode}`), tap = files.get(`${run.label}/run.tap`);
		assert.equal(end.started, run.started); assert.equal(end.finished, run.finished); assert.equal(sha256(tap), run.tapSha256);
		assertNominalSubtypeWitRun({ ...run, start, end, tap });
		for(const path of index.selectedSources) assert.equal(start.sources[path], sha256(files.get("sources/" + path)));
		executions += checked.executions; checks += checked.checks; rejections += checked.rejections;
		hostRejections += checked.hostRejections; snapshotControls += checked.snapshotControls;
	}
	assert.equal(executions, 8); assert.equal(checks, 54240); assert.equal(rejections, 4132);
	assert.equal(hostRejections, 68); assert.equal(snapshotControls, 120);
	for(let index_ = 1; index_ < index.runs.length; index_++) assert.ok(Date.parse(index.runs[index_ - 1].finished) <= Date.parse(index.runs[index_].started));
});

test("nominal WIT archive preserves harness and disk failures without accepting them", async () => {
	const { index, files } = await load(); assert.equal(index.failedAttempts.length, 2);
	for(const [position, failure] of index.failedAttempts.entries())
	{
		assert.equal(failure.label, position ? "failed-r2-ordinary-result-only" : "failed-r1-ordinary-full");
		assert.equal(failure.route, "ordinary"); assert.equal(failure.mode, position ? "result-only" : "full");
		assert.equal(failure.code, 1);
		const start = JSON.parse(files.get(`${failure.label}/start.json`)), ends = JSON.parse(files.get(`${failure.label}/runs.json`));
		const end = ends.find(item => item.selection === `ordinary/${failure.mode}`), tap = files.get(`${failure.label}/run.tap`);
		assert.equal(start.head, position ? index.producerCommit : "15d802e07d1d6a022830fbc74b316e05b74cd53a");
		assert.equal(failure.producerCommit, start.head); assert.equal(end.code, 1); assert.equal(end.signal, null);
		assert.equal(end.sourcesChecked, Object.keys(start.sources).length); assert.deepEqual(end.changed, []);
		assert.equal(end.sha256, sha256(tap)); assert.equal(failure.tapSha256, sha256(tap)); assert.equal(end.bytes, tap.length);
		assert.match(tap.toString(), position ? /requires 2 GiB free disk/u : /assert\.match|AssertionError/u);
		assert.match(tap.toString(), /# pass 0\n# fail 1/u);
		const records = selectionFiles(files, failure); assert.deepEqual([...records.keys()].sort(), failure.records);
		for(const path of ["report.json", "installed.json", "relocated.json"]) assert.equal(records.has(path), false);
		const receipt = JSON.parse(records.get("handoff/package-set-receipt.json"));
		assert.deepEqual(receipt.packages[0].artifacts[0], failure.artifact);
		assert.throws(() => assertNominalSubtypeWitRun({ ...failure, start, end, tap }));
	}
});

test("nominal WIT archive refuses every missing or corrupted original", async t => {
	const { files } = await load(); files.set("index.json", await readFile(`${root}/index.json`));
	for(const target of files.keys())
	{
		await assert.rejects(checkArchive(async path => {
			if(path === target) throw new Error("Missing original"); return files.get(path);
		}));
		await assert.rejects(checkArchive(async path => path === target ? Buffer.concat([files.get(path), Buffer.from("changed")]) : files.get(path)));
	}
	t.diagnostic(`${files.size * 2} missing/corrupted original controls`);
});

test("nominal WIT provenance refuses changed selections and incomplete terminal TAP", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const originalStart = JSON.parse(files.get(`${run.label}/start.json`));
		const originalEnd = JSON.parse(files.get(`${run.label}/runs.json`)).find(item => item.selection === `${run.route}/${run.mode}`), tap = files.get(`${run.label}/run.tap`);
		for(const mutate of [
			value => { value.head = "0".repeat(40); }
			, value => { value.args.push("--test-skip-pattern=.*"); }
			, value => { value.selections.push(`${run.route}/${run.mode}`); }
			, value => { value.sources["../outside"] = "0".repeat(64); }
		]) {
			const start = structuredClone(originalStart); mutate(start);
			assert.throws(() => assertNominalSubtypeWitRun({ ...run, start, end: originalEnd, tap })); controls++;
		}
		for(const mutate of [
			value => { value.code = 1; }, value => { value.signal = "SIGTERM"; }
			, value => { value.changed = ["src/analyze/NativeExports.lean"]; }
			, value => { value.bytes--; }, value => { value.selection = "unknown/full"; }
			, value => { value.finished = new Date(Date.parse(originalEnd.started) - 1).toISOString(); }
		]) {
			const end = structuredClone(originalEnd); mutate(end);
			assert.throws(() => assertNominalSubtypeWitRun({ ...run, start: originalStart, end, tap })); controls++;
		}
		for(const text of [
			tap.toString().replace("# pass 1", "# pass 0")
			, tap.toString().replace("# skipped 0", "# skipped 1")
			, tap.toString().replace("ok 1 -", "not ok 1 -")
			, tap.toString() + "incomplete\n"
		]) {
			const altered = Buffer.from(text), end = { ...originalEnd, sha256: sha256(altered), bytes: altered.length };
			assert.throws(() => assertNominalSubtypeWitRun({ ...run, start: originalStart, end, tap: altered })); controls++;
		}
	}
	assert.equal(controls, 56); t.diagnostic(`${controls} coordinated provenance controls`);
});

test("nominal WIT checker refuses coordinated record and constructor changes", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const originals = selectionFiles(files, run), checked = await checkNominalSubtypeWitControls(async path => originals.get(path), run);
		assert.deepEqual(checked, run.controls); assert.equal(checked.recordControls, run.records.length * 2);
		assert.equal(checked.executionControls, 20); assert.equal(checked.toolControls, 12); assert.equal(checked.resourceControls, 4);
		assert.equal(checked.environmentControls, 15); assert.equal(checked.packageControls, 5);
		assert.equal(checked.modelControls, run.mode === "full" ? 6 : 5);
		controls += Object.values(checked).reduce((total, count) => total + count, 0);
	}
	assert.equal(controls, 974); t.diagnostic(`${controls} record and semantic controls`);
});
