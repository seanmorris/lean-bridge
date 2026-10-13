/**
 * Authenticate original nominal JVM packages and adversarial archive controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { nominalSubtypeJvmOriginal, nominalSubtypeJvmGenerator } from "./nominal-subtype-jvm-generators.mjs";
import { checkNominalSubtypeJvmReport } from "./nominal-subtype-jvm-report.mjs";
import { assertNominalSubtypeJvmRun, nominalSubtypeJvmSelections } from "./nominal-subtype-jvm-provenance.mjs";
import { checkNominalSubtypeJvmControls } from "./nominal-subtype-jvm-controls.mjs";

const root = "docs/evidence/nominal-subtype-jvm-20261013";
const indexSha256 = "ee5dfe4809453595b3d662d2624a0c50c4e93c908d63195176bbd0f9dc56e0e1";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-jvm-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypeJvmSelections);
	for(const file of index.files)
	{
		assert.ok(/^[A-Za-z0-9_.$/-]+$/u.test(file.path) && file.path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};
const load = () => checkArchive(path => readFile(`${root}/${path}`));
const selectionFiles = (files, run) => {
	const prefix = `${run.label}/records/`;
	return new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
};

test("nominal JVM archive authenticates four packages and twenty-four complete executions", async () => {
	assert.ok((await readFile("tests/helpers/nominal-subtype-jvm-tests.mjs", "utf8"))
		.includes('import "./nominal-subtype-jvm-evidence-tests.mjs";'));
	const { index, files } = await load();
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...files.keys(), "index.json"].sort());
	for(const path of index.selectedSources)
		assert.deepEqual(files.get(`sources/${path}`), nominalSubtypeJvmOriginal(index.producerCommit, path));
	assert.deepEqual(index.generatorClosure, (await nominalSubtypeJvmGenerator(index.producerCommit)).paths);
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	for(const name of index.checkers)
	{
		const path = `tests/helpers/nominal-subtype-jvm-${name}.mjs`, expected = sha256(files.get(`checkers/${name}.mjs`));
		assert.equal(sha256(beforeFinRefinementSource(path, await readFile(path), expected)), expected);
	}
	let executions = 0, checks = 0, rejections = 0, hostRejections = 0, snapshotControls = 0;
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		assert.match(run.javaVersion, /^openjdk 22\.0\.2 2024-07-16\n/u);
		const originals = selectionFiles(files, run);
		assert.deepEqual([...originals.keys()].sort(), run.records);
		const checked = await checkNominalSubtypeJvmReport(async path => originals.get(path), run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		const start = JSON.parse(files.get(`${run.label}/start.json`));
		const end = JSON.parse(files.get(`${run.label}/end.json`)), tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(run.tapSha256, sha256(tap));
		assertNominalSubtypeJvmRun({ ...run, start, end, tap });
		for(const path of index.selectedSources) assert.equal(start.sources[path], sha256(files.get(`sources/${path}`)));
		executions += checked.executions; checks += checked.checks; rejections += checked.rejections;
		hostRejections += checked.hostRejections; snapshotControls += checked.snapshotControls;
	}
	assert.equal(executions, 24); assert.equal(checks, 75732); assert.equal(rejections, 12384);
	assert.equal(hostRejections, 78); assert.equal(snapshotControls, 192);
	for(let index_ = 1; index_ < index.runs.length; index_++)
		assert.ok(Date.parse(index.runs[index_ - 1].finished) <= Date.parse(index.runs[index_].started));
});

test("nominal JVM archive refuses every missing or corrupted original", async t => {
	const { files } = await load(); files.set("index.json", await readFile(`${root}/index.json`));
	for(const target of files.keys())
	{
		await assert.rejects(checkArchive(async path => {
			if(path === target) throw new Error("missing original");
			return files.get(path);
		}));
		await assert.rejects(checkArchive(async path => path === target ? Buffer.concat([files.get(path), Buffer.from("changed")]) : files.get(path)));
	}
	assert.equal(files.size, 620); t.diagnostic(`${2 * files.size} missing/corrupted original controls`);
});

test("nominal JVM provenance refuses changed selections, resource floors and incomplete TAP", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const originalStart = JSON.parse(files.get(`${run.label}/start.json`));
		const originalEnd = JSON.parse(files.get(`${run.label}/end.json`)), tap = files.get(`${run.label}/run.tap`);
		const startChanges = [
			value => { value.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_TEST = "0"; }
			, value => { value.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_MODES = "full,result-only"; }
			, value => { value.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_ROUTES = "ordinary,reviewed"; }
			, value => { value.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.99"; }
			, value => { value.environment.LEAN_NUM_THREADS = "8"; }
			, value => { value.command = "/unavailable/node"; }
			, value => { value.args.push("--test-skip-pattern=.*"); }
			, value => { value.resources.observations[0].freeBytes = 1024; }
			, value => { value.resources.observations[0].availableBytes = 1024; }
			, value => { value.resources.observations.at(-1).load = 6; }
			, value => { value.producerCommit = "0".repeat(40); }
		];
		for(const mutate of startChanges)
		{
			const start = structuredClone(originalStart); mutate(start);
			const end = { ...originalEnd, ...start };
			assert.throws(() => assertNominalSubtypeJvmRun({ ...run, start, end, tap })); controls++;
		}
		const endChanges = [
			value => { value.code = 1; }
			, value => { value.signal = "SIGTERM"; }
			, value => { value.sourceChanges = ["src/analyze/NativeExports.lean"]; }
			, value => { value.bytes--; }
			, value => { value.finished = new Date(Date.parse(originalStart.started) - 1).toISOString(); }
		];
		for(const mutate of endChanges)
		{
			const end = structuredClone(originalEnd); mutate(end);
			assert.throws(() => assertNominalSubtypeJvmRun({ ...run, start: originalStart, end, tap })); controls++;
		}
		const tapChanges = [tap.toString().replace("# pass 1", "# pass 0")
			, tap.toString().replace("# skipped 0", "# skipped 1")
			, tap.toString().replace("ok 1 -", "not ok 1 -")
			, tap.toString() + "incomplete\n"];
		for(const text of tapChanges)
		{
			const altered = Buffer.from(text), end = { ...originalEnd, sha256: sha256(altered), bytes: altered.length };
			assert.throws(() => assertNominalSubtypeJvmRun({ ...run, start: originalStart, end, tap: altered })); controls++;
		}
	}
	assert.equal(controls, 80); t.diagnostic(`${controls} coordinated provenance controls`);
});

test("nominal JVM checker refuses coordinated record, package, probe and constructor changes", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const originals = selectionFiles(files, run);
		const checked = await checkNominalSubtypeJvmControls(async path => originals.get(path), run);
		assert.deepEqual(checked, run.controls);
		assert.equal(checked.recordControls, run.records.length * 2);
		assert.equal(checked.executionControls, 42); assert.equal(checked.probeControls, 22);
		assert.equal(checked.packageControls, 4); assert.equal(checked.resourceControls, 4);
		assert.equal(checked.modelControls, run.mode === "full" ? 5 : 4);
		controls += Object.values(checked).reduce((total, count) => total + count, 0);
	}
	assert.equal(controls, 1406); t.diagnostic(`${controls} record and semantic controls`);
});
