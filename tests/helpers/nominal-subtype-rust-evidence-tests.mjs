/**
 * Authenticate all original nominal Rust executions and adversarial controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { checkNominalSubtypeRustReport, nominalSubtypeRustRecords } from "./nominal-subtype-rust-report.mjs";
import { nominalSubtypeRustOriginal, nominalSubtypeRustGenerator } from "./nominal-subtype-rust-generators.mjs";
import { assertNominalSubtypeRustRun, nominalSubtypeRustSelections } from "./nominal-subtype-rust-provenance.mjs";
import { checkNominalSubtypeRustControls } from "./nominal-subtype-rust-controls.mjs";

const root = "docs/evidence/nominal-subtype-rust-20261012";
const indexSha256 = "8fc801f8f1e6e1af7c4e6844ded44a46b700702b11ba979071cef0b194ae5495";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-rust-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypeRustSelections);
	for(const file of index.files)
	{
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(file.path) && file.path.split("/").every(part => part && part !== "." && part !== ".."));
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

test("nominal Rust archive authenticates four installations and twelve installed, relocated and source-free executions", async () => {
	const { index, files } = await load();
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...files.keys(), "index.json"].sort());
	for(const path of index.selectedSources)
		assert.equal(sha256(files.get(`sources/${path}`)), sha256(nominalSubtypeRustOriginal(index.producerCommit, path)));
	assert.deepEqual(index.generatorClosure, (await nominalSubtypeRustGenerator(index.producerCommit)).paths);
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	for(const name of index.checkers)
	{
		const path = `tests/helpers/nominal-subtype-rust-${name}.mjs`, expected = sha256(files.get(`checkers/${name}.mjs`));
		assert.equal(sha256(beforeFinRefinementSource(path, await readFile(path), expected)), expected);
	}
	let executions = 0, checks = 0, rejections = 0;
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		const originals = selectionFiles(files, run), crate = JSON.parse(originals.get("crate.json")), dependencies = JSON.parse(originals.get("dependencies.json"));
		assert.deepEqual([...originals.keys()].sort(), nominalSubtypeRustRecords(run.route, crate, dependencies).sort());
		const checked = await checkNominalSubtypeRustReport(async path => originals.get(path), run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		assert.equal(run.reportSha256, sha256(originals.get("report.json")));
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`)), tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(run.tapSha256, sha256(tap));
		assertNominalSubtypeRustRun({ ...run, start, end, tap, runner: files.get("runner.mjs") });
		for(const name of ["rustc", "cargo"]) assert.equal(run.toolchain[name].command, start.environment[`LEAN_BRIDGE_${name.toUpperCase()}`]);
		executions += checked.executions; checks += checked.executions * checked.counts.checks;
		rejections += checked.executions * checked.counts.rejections;
	}
	assert.equal(executions, 12); assert.equal(checks, 37788); assert.equal(rejections, 6192);
	for(let index_ = 1; index_ < index.runs.length; index_++)
		assert.ok(Date.parse(index.runs[index_ - 1].finished) <= Date.parse(index.runs[index_].started));
});

test("nominal Rust archive refuses every missing or corrupted original", async t => {
	const { files } = await load(); files.set("index.json", await readFile(`${root}/index.json`));
	for(const target of files.keys())
	{
		await assert.rejects(checkArchive(async path => {
			if(path === target) throw new Error("missing original");
			return files.get(path);
		}));
		await assert.rejects(checkArchive(async path => path === target ? Buffer.concat([files.get(path), Buffer.from("changed")]) : files.get(path)));
	}
	t.diagnostic(`${2 * files.size} missing/corrupted original controls`);
});

test("nominal Rust provenance rejects substituted tools, incomplete TAP and resource stops", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const originalStart = JSON.parse(files.get(`${run.label}/start.json`)), originalEnd = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`), runner = files.get("runner.mjs");
		const changes = [
			start => { start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_TEST = "0"; }
			, start => { start.environment.LEAN_BRIDGE_RUSTC = "/unavailable/rust"; }
			, start => { start.environment.LEAN_BRIDGE_CARGO = "/unavailable/gem"; }
			, start => { start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_MODES = "full,result-only"; }
			, start => { start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_ROUTES = "ordinary,reviewed"; }
			, start => { start.environment.LEAN_NUM_THREADS = "8"; }
			, start => { start.initial.freeMiB = 100; }
			, start => { start.initial.availableMiB = 100; }
			, start => { start.initial.load = 8; }
			, start => { start.runnerSha256 = "0".repeat(64); }
			, start => { start.revision = "0".repeat(40); }
			, start => { start.args[1] = "0"; }
			, (_, end) => { end.code = 1; }
			, (_, end) => { end.signal = "SIGTERM"; }
			, (_, end) => { end.stopReason = "disk-floor"; }
			, (_, end) => { end.minimum.freeMiB = 767; }
			, (_, end) => { end.minimum.availableMiB = 767; }
			, (_, end) => { end.error = "failed"; }
			, (start, end) => { end.finished = new Date(Date.parse(start.started) - 1).toISOString(); }
		];
		for(const mutate of changes)
		{
			const start = structuredClone(originalStart), end = structuredClone(originalEnd); mutate(start, end);
			assert.throws(() => assertNominalSubtypeRustRun({ ...run, start, end, tap, runner })); controls++;
		}
		for(const text of [tap.toString().replace("# pass 1", "# pass 0"), tap.toString().replace("# skipped 0", "# skipped 1"), tap.toString().replace("ok 1 -", "not ok 1 -"), tap.toString() + "incomplete\n"])
		{
			const altered = Buffer.from(text), end = { ...originalEnd, tapSha256: sha256(altered) };
			assert.throws(() => assertNominalSubtypeRustRun({ ...run, start: originalStart, end, tap: altered, runner })); controls++;
		}
	}
	assert.equal(controls, 92); t.diagnostic(`${controls} coordinated provenance controls`);
});

test("nominal Rust checker rejects coordinated crate, toolchain, environment and compiler changes", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const originals = selectionFiles(files, run), checked = await checkNominalSubtypeRustControls(async path => originals.get(path), run);
		assert.equal(checked.recordControls, run.records * 2); assert.equal(checked.environmentControls, run.mode === "full" ? 60 : 61); assert.equal(checked.executionControls, 24);
		assert.equal(checked.packageControls, 5); assert.equal(checked.modelControls, run.mode === "full" ? 5 : 4);
		controls += checked.recordControls + checked.environmentControls + checked.packageControls + checked.modelControls + checked.executionControls;
	}
	assert.equal(controls, 936); t.diagnostic(`${controls} record, closure, package and compiler controls`);
});
