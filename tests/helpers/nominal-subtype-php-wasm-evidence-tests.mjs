/**
 * Authenticate original nominal PHP-Wasm packages and reject altered acceptance claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { checkNominalSubtypePhpWasmReport } from "./nominal-subtype-php-wasm-report.mjs";
import { checkNominalSubtypePhpWasmControls } from "./nominal-subtype-php-wasm-controls.mjs";
import { nominalSubtypePhpWasmSelections, assertNominalSubtypePhpWasmRun } from "./nominal-subtype-php-wasm-provenance.mjs";
import { nominalSubtypePhpWasmOriginal, nominalSubtypePhpWasmSnapshot, nominalSubtypePhpWasmGeneratorClosure } from "./nominal-subtype-php-wasm-sources.mjs";

const root = "docs/evidence/nominal-subtype-php-wasm-20261014";
const indexSha256 = "4eb5779d93b8b6b4fb098fa6b5c72f86e0e977f327b597bf5d07a60b873c0988";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-php-wasm-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypePhpWasmSelections);
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
const launch = (files, run) => ({
	...run
	, start: JSON.parse(files.get(`${run.label}/start.json`))
	, end: JSON.parse(files.get(`${run.label}/end.json`))
	, preflight: JSON.parse(files.get(`${run.label}/preflight.json`))
	, independentRuntime: JSON.parse(files.get(`${run.label}/independent-runtime.json`))
	, tap: files.get(`${run.label}/run.tap`), runner: files.get("runner.mjs")
	, report: JSON.parse(files.get(`${run.label}/records/report.json`))
});

test("nominal PHP-Wasm archive authenticates four installed selections, twelve archives and 48 replayed contexts", async () => {
	assert.ok((await readFile("tests/helpers/nominal-subtype-php-wasm-tests.mjs", "utf8")).includes('import "./nominal-subtype-php-wasm-evidence-tests.mjs";'));
	const { index, files } = await load();
	assert.deepEqual(await nativeArtifactPaths(root), [...files.keys(), "index.json"].sort());
	const snapshot = nominalSubtypePhpWasmSnapshot(index.producerCommit);
	assert.equal(index.sourceSnapshotCount, Object.keys(snapshot).length);
	assert.deepEqual(index.generatorClosure, nominalSubtypePhpWasmGeneratorClosure(index.producerCommit));
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	for(const path of index.selectedSources)
	{
		assert.deepEqual(files.get("sources/" + path), nominalSubtypePhpWasmOriginal(index.producerCommit, path));
		assert.equal(snapshot[path], sha256(files.get("sources/" + path)));
	}
	for(const path of index.checkers)
	{
		const expected = sha256(files.get("checkers/" + path));
		assert.equal(sha256(beforeFinRefinementSource(path, await readFile(path), expected)), expected);
	}
	let previousEnd = 0, executions = 0, checks = 0, rejections = 0, archives = 0;
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		const originals = selectionFiles(files, run);
		const checked = await checkNominalSubtypePhpWasmReport(async path => originals.get(path), run);
		assert.deepEqual([...originals.keys()].sort(), checked.records);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		assert.equal(run.reportSha256, sha256(originals.get("report.json")));
		const input = launch(files, run), { start, end, report, tap } = input;
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(sha256(tap), run.tapSha256);
		assert.deepEqual(start.sources, snapshot); assertNominalSubtypePhpWasmRun(input);
		assert.ok(Date.parse(start.started) >= previousEnd); previousEnd = Date.parse(end.finished);
		assert.equal(report.phpWasm.browserVersion, run.browserVersion);
		executions += checked.executions; checks += checked.counts.checks * checked.executions;
		rejections += checked.counts.rejections * checked.executions;
		archives += checked.records.filter(path => /\.(?:tgz|zip)$/u.test(path)).length;
	}
	assert.equal(executions, 48); assert.equal(archives, 12); assert.equal(checks, 152784); assert.equal(rejections, 24768);
});

test("nominal PHP-Wasm archive refuses each missing or corrupted index and original", async t => {
	const { files } = await load(); files.set("index.json", await readFile(`${root}/index.json`));
	for(const target of files.keys())
	{
		await assert.rejects(checkArchive(async path => { assert.notEqual(path, target, "Missing original"); return files.get(path); }));
		await assert.rejects(checkArchive(async path => path === target ? Buffer.concat([files.get(path), Buffer.from("changed")]) : files.get(path)));
	}
	t.diagnostic(`${files.size * 2} missing/corrupted index and original controls`);
});

test("nominal PHP-Wasm archive refuses coordinated compiler, caller, package and host substitutions", async t => {
	const { index, files } = await load(); let total = 0;
	for(const run of index.runs)
	{
		const controls = await checkNominalSubtypePhpWasmControls(selectionFiles(files, run), run);
		assert.deepEqual(controls, run.controls); assert.equal(controls.recordControls, 2 * run.records.length);
		total += controls.recordControls + controls.semanticControls;
		t.diagnostic(`${run.label}: ${JSON.stringify(controls)}`);
	}
	assert.equal(total, 608);
});

test("nominal PHP-Wasm provenance refuses altered launch identity, runtime, tools and incomplete TAP", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const input = launch(files, run), { start, end, tap } = input;
		for(const mutate of [
			value => { value.producerCommit = "0".repeat(40); }
			, value => { value.route = "unknown"; }, value => { value.mode = "unknown"; }
			, value => { value.runnerSha256 = "0".repeat(64); }
			, value => { value.runtime.node = "v0.0.0"; }
			, value => { value.args.push("--test-skip-pattern=.*"); }
			, value => { value.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_TEST = "0"; }
			, value => { value.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_MODES = "unknown"; }
			, value => { value.sources["../outside"] = "0".repeat(64); }
			, value => { value.initial.freeMiB = 768; }
			, value => { value.guard.observations.pop(); }
			, value => { value.toolIdentities.php.sha256 = "0".repeat(64); }
			, value => { value.toolIdentities.chromium.path = "/missing/chromium"; }
			, value => { value.sharedRuntimeIdentity = "0".repeat(64); }
		]) {
			const changed = structuredClone(start); mutate(changed);
			assert.throws(() => assertNominalSubtypePhpWasmRun({ ...input, start: changed })); controls++;
		}
		for(const mutate of [
			value => { value.code = 1; }, value => { value.signal = "SIGTERM"; }
			, value => { value.stopReason = "disk-floor"; }
			, value => { value.changed = ["src/analyze/NativeExports.lean"]; }
			, value => { value.sourcesChecked--; }
			, value => { value.runnerUnchanged = false; }
			, value => { value.headUnchanged = false; }
			, value => { value.trackedClean = false; }
			, value => { value.runtimeUnchanged = false; }
			, value => { value.runtimeError = "unreadable runtime"; }
			, value => { value.toolsChanged.push("php"); }
			, value => { value.minimum.freeMiB = 767; }
			, value => { value.finished = new Date(Date.parse(start.started) - 1).toISOString(); }
		]) {
			const changed = structuredClone(end); mutate(changed);
			assert.throws(() => assertNominalSubtypePhpWasmRun({ ...input, end: changed })); controls++;
		}
		for(const field of ["preflight", "independentRuntime"])
		{
			const changed = structuredClone(input[field]);
			if(field === "preflight") changed.sources = {};
			else changed.manifest.pointerBits = 64;
			assert.throws(() => assertNominalSubtypePhpWasmRun({ ...input, [field]: changed })); controls++;
		}
		for(const source of [
			tap.toString().replace("# pass 1", "# pass 0")
			, tap.toString().replace("# skipped 0", "# skipped 1")
			, tap.toString().replace("ok 1 -", "not ok 1 -")
			, tap.toString().replace("1..1", "1..2")
			, tap.toString() + "incomplete\n", tap.toString() + tap.toString()
			, ...["not ok 1 - hidden failure", "ok 1 - hidden pass", "# Subtest: hidden", "Bail out! stopped"]
				.map(line => tap.toString().replace("\n1..1\n", `\n    ${line}\n1..1\n`))
		]) {
			const changed = Buffer.from(source);
			assert.throws(() => assertNominalSubtypePhpWasmRun({ ...input, tap: changed, end: { ...end, tapSha256: sha256(changed) } })); controls++;
		}
	}
	assert.equal(controls, 156); t.diagnostic(`${controls} coordinated provenance controls`);
});
