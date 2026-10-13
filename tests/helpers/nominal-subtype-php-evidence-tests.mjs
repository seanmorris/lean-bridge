/**
 * Authenticate original nominal PHP packages and adversarial archive controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { nominalSubtypePhpOriginal, nominalSubtypePhpGenerator } from "./nominal-subtype-php-generators.mjs";
import { checkNominalSubtypePhpReport } from "./nominal-subtype-php-report.mjs";
import { assertNominalSubtypePhpRun, nominalSubtypePhpSelections } from "./nominal-subtype-php-provenance.mjs";
import { checkNominalSubtypePhpControls } from "./nominal-subtype-php-controls.mjs";

const root = "docs/evidence/nominal-subtype-php-20261013";
const indexSha256 = "9f22ebf9f08e25f38b909690a6bc27b024f161b339eb98c6c2200e4c4039c2c2";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-php-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypePhpSelections);
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

test("nominal PHP archive authenticates four packages and sixteen complete executions", async () => {
	assert.ok((await readFile("tests/helpers/nominal-subtype-php-tests.mjs", "utf8"))
		.includes('import "./nominal-subtype-php-evidence-tests.mjs";'));
	const { index, files } = await load();
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...files.keys(), "index.json"].sort());
	for(const path of index.selectedSources)
		assert.deepEqual(files.get(`sources/${path}`), nominalSubtypePhpOriginal(index.producerCommit, path));
	assert.deepEqual(index.generatorClosure, (await nominalSubtypePhpGenerator(index.producerCommit)).paths);
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	for(const name of index.checkers)
	{
		const path = `tests/helpers/nominal-subtype-php-${name}.mjs`, expected = sha256(files.get(`checkers/${name}.mjs`));
		assert.equal(sha256(beforeFinRefinementSource(path, await readFile(path), expected)), expected);
	}
	let executions = 0, checks = 0, rejections = 0, hostRejections = 0, snapshotControls = 0;
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		assert.equal(run.phpVersion, "8.2.33"); assert.equal(run.composerVersion, "2.5.5");
		const originals = selectionFiles(files, run);
		assert.deepEqual([...originals.keys()].sort(), run.records);
		const checked = await checkNominalSubtypePhpReport(async path => originals.get(path), run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		const start = JSON.parse(files.get(`${run.label}/start.json`));
		const end = JSON.parse(files.get(`${run.label}/end.json`)), tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(run.tapSha256, sha256(tap));
		assertNominalSubtypePhpRun({ ...run, start, end, tap, runner: files.get("runner.mjs") });
		for(const path of index.selectedSources) assert.equal(start.sources[path], sha256(files.get(`sources/${path}`)));
		executions += checked.executions; checks += checked.checks; rejections += checked.rejections;
		hostRejections += checked.hostRejections; snapshotControls += checked.snapshotControls;
	}
	assert.equal(executions, 16); assert.equal(checks, 50928); assert.equal(rejections, 8256);
	assert.equal(hostRejections, 256); assert.equal(snapshotControls, 128);
	for(let index_ = 1; index_ < index.runs.length; index_++)
		assert.ok(Date.parse(index.runs[index_ - 1].finished) <= Date.parse(index.runs[index_].started));
});

test("nominal PHP archive preserves the load-guard failure without counting an installed pass", async () => {
	const { index, files } = await load(); assert.equal(index.failedAttempts.length, 1);
	const failure = index.failedAttempts[0];
	assert.equal(failure.label, "failed-reviewed-full-r1"); assert.equal(failure.code, 1);
	assert.equal(failure.route, "reviewed"); assert.equal(failure.mode, "full");
	const start = JSON.parse(files.get(`${failure.label}/start.json`));
	const end = JSON.parse(files.get(`${failure.label}/end.json`)), tap = files.get(`${failure.label}/run.tap`);
	assert.equal(end.code, 1); assert.equal(end.signal, null);
	assert.equal(start.producerCommit, index.producerCommit); assert.equal(end.head, index.producerCommit);
	assert.equal(start.route, failure.route); assert.equal(start.mode, failure.mode);
	assert.equal(end.sourcesChecked, Object.keys(start.sources).length);
	for(const key of ["changed", "added", "removed"]) assert.deepEqual(end[key], []);
	assert.equal(end.tapSha256, sha256(tap)); assert.equal(failure.tapSha256, sha256(tap)); assert.equal(end.tapBytes, tap.length);
	assert.match(tap.toString(), /host load remained at or above 6 for five minutes/u);
	assert.match(tap.toString(), /# pass 0\n# fail 1/u);
	for(const path of index.selectedSources) assert.equal(start.sources[path], sha256(files.get(`sources/${path}`)));
	assert.throws(() => assertNominalSubtypePhpRun({ ...index.runs.find(run => run.route === "reviewed" && run.mode === "full")
		, prefix: failure.prefix, start, end, tap
		, runner: files.get("runner.mjs") }));
});

test("nominal PHP archive refuses every missing or corrupted original", async t => {
	const { files } = await load(); files.set("index.json", await readFile(`${root}/index.json`));
	for(const target of files.keys())
	{
		await assert.rejects(checkArchive(async path => {
			if(path === target) throw new Error("missing original");
			return files.get(path);
		}));
		await assert.rejects(checkArchive(async path => path === target ? Buffer.concat([files.get(path), Buffer.from("changed")]) : files.get(path)));
	}
	assert.equal(files.size, 340); t.diagnostic(`${2 * files.size} missing/corrupted original controls`);
});

test("nominal PHP provenance refuses changed selections, resource floors and incomplete TAP", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const originalStart = JSON.parse(files.get(`${run.label}/start.json`));
		const originalEnd = JSON.parse(files.get(`${run.label}/end.json`)), tap = files.get(`${run.label}/run.tap`);
		const startChanges = [
			value => { value.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_TEST = "0"; }
			, value => { value.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_MODES = "full,result-only"; }
			, value => { value.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_ROUTES = "ordinary,reviewed"; }
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
			const end = { ...originalEnd, mode: start.mode, route: start.route, producerCommit: start.producerCommit, started: start.started };
			assert.throws(() => assertNominalSubtypePhpRun({ ...run, start, end, tap, runner: files.get("runner.mjs") })); controls++;
		}
		const endChanges = [
			value => { value.code = 1; }
			, value => { value.signal = "SIGTERM"; }
			, value => { value.changed = ["src/analyze/NativeExports.lean"]; }
			, value => { value.tapBytes--; }
			, value => { value.finished = new Date(Date.parse(originalStart.started) - 1).toISOString(); }
		];
		for(const mutate of endChanges)
		{
			const end = structuredClone(originalEnd); mutate(end);
			assert.throws(() => assertNominalSubtypePhpRun({ ...run, start: originalStart, end, tap, runner: files.get("runner.mjs") })); controls++;
		}
		const tapChanges = [tap.toString().replace("# pass 1", "# pass 0")
			, tap.toString().replace("# skipped 0", "# skipped 1")
			, tap.toString().replace("ok 1 -", "not ok 1 -")
			, tap.toString() + "incomplete\n"];
		for(const text of tapChanges)
		{
			const altered = Buffer.from(text), end = { ...originalEnd, tapSha256: sha256(altered), tapBytes: altered.length };
			assert.throws(() => assertNominalSubtypePhpRun({ ...run, start: originalStart, end, tap: altered, runner: files.get("runner.mjs") })); controls++;
		}
	}
	assert.equal(controls, 80); t.diagnostic(`${controls} coordinated provenance controls`);
});

test("nominal PHP checker refuses coordinated record, package, tool and constructor changes", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const originals = selectionFiles(files, run);
		const checked = await checkNominalSubtypePhpControls(async path => originals.get(path), run);
		assert.deepEqual(checked, run.controls);
		assert.equal(checked.recordControls, run.records.length * 2);
		assert.equal(checked.executionControls, 40); assert.equal(checked.toolControls, 12);
		assert.equal(checked.packageControls, 4); assert.equal(checked.resourceControls, 4); assert.equal(checked.environmentControls, 10);
		assert.equal(checked.modelControls, run.mode === "full" ? 6 : 5);
		controls += Object.values(checked).reduce((total, count) => total + count, 0);
	}
	assert.equal(controls, 830); t.diagnostic(`${controls} record and semantic controls`);
});
