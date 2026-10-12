/**
 * Authenticate native nominal originals and reject altered compiler or replay claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalSubtypeNativeReport, nominalSubtypeNativeRecordPaths } from "./nominal-subtype-native-report.mjs";

const root = "docs/evidence/nominal-subtype-native-20261011";
const indexSha256 = "ce84736ea4a7e580e66eeacf49412aba3c6291e301a730a603d342ec7b57d992";
const selections = [["ordinary", "full"], ["reviewed", "full"], ["ordinary", "result-only"], ["reviewed", "result-only"]];
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-native-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), selections);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").some(part => ["", ".", ".."].includes(part)));
		assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};

test("four native nominal selections reproduce, physically relocate and match frozen producer sources", async () => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	for(const source of index.selectedSources)
		assert.deepEqual(files.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	let checks = 0, executions = 0;
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit);
		assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.deepEqual(run.counts, run.mode === "full" ? { c: 4149, cpp: 4122 } : { c: 2042, cpp: 2042 });
		const prefix = `${run.label}/records/`, read = async path => files.get(prefix + path);
		const checked = await checkNominalSubtypeNativeReport(read, run);
		assert.equal(checked.executions, 4); assert.equal(checked.dispatchObserved, false);
		checks += 2 * (checked.counts.c + checked.counts.cpp); executions += checked.executions;
		assert.equal(run.reportSha256, sha256(await read("report.json")));
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), [...nominalSubtypeNativeRecordPaths].sort());
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.revision, run.producerCommit); assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
		assert.equal(start.route, run.route); assert.equal(start.mode, run.mode);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished);
		assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]);
		assert.ok(start.initial.freeMiB >= 2048 && start.initial.availableMiB >= 2048 && start.initial.load < 6);
		assert.ok(end.minimum.freeMiB >= 768 && end.minimum.availableMiB >= 768);
		assert.ok(tap.toString().includes(`ok 1 - installed native nominal Subtypes reproduce and relocate ${run.route} ${run.mode}\n`));
		assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
		assert.equal(start.command, "/usr/bin/nice");
		assert.deepEqual(start.args.slice(0, 8), ["-n", "19", "/usr/bin/ionice", "-c", "3", "/usr/bin/taskset", "-c", "3"]);
		assert.deepEqual(start.args.slice(9), ["--test", "--test-concurrency=1", "tests/helpers/nominal-subtype-native-installed-tests.mjs"]);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_PROFILES, "c,cpp");
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_ROUTES, run.route);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_MODES, run.mode);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_OUTPUT, run.prefix + "-records");
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, run.runtime.glibc);
	}
	assert.equal(checks, 49420); assert.equal(executions, 16);
	for(let position = 1; position < index.runs.length; position++)
		assert.ok(Date.parse(index.runs[position - 1].finished) <= Date.parse(index.runs[position].started));
});

test("native nominal archive refuses every missing or corrupted original", async t => {
	const { files } = await checkArchive(path => readFile(`${root}/${path}`));
	files.set("index.json", await readFile(`${root}/index.json`));
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

test("native nominal checker refuses coordinated false isolation, result projection and per-use choices", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = `${run.label}/records/`, originals = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const changes = [
			report => { report.independentBuilds = 1; }
			, report => { report.mode = run.mode === "full" ? "result-only" : "full"; }
			, report => { report.declaredGlibcFloor = "2.38"; }
			, report => { report.runtime.glibc.stdout = "glibc 2.38\n"; }
			, report => { report.profiles.pop(); }
			, ...["reproducible", "authorInputsUnchanged"].map(key => report => { report[key] = false; })
			, ...[0, 1].flatMap(index => [
				report => { report.reports[index].checks = 1; }
				, report => { report.reports[index].dispatch.observed = true; }
				, report => { report.reports[index].sourceSha256 = "0".repeat(64); }
				, report => { report.reports[index].compiler.code = 1; }
				, report => { report.reports[index].runs[1].relocated = false; }
				, report => { report.reports[index].runs[1].stdout = "nominal-subtype-ok:1\n"; }
				, ...["compilerFreePath", "compilerFreeReplay", "offlineInstall", "relocatedInstallation", "sourceRemovedBeforeInstallation"].map(key => report => { report.reports[index][key] = false; })
			])
		];
		for(const change of changes)
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			const set = (path, value) => altered.set(path, Buffer.from(canonicalJson(value)));
			change(report); set("report.json", report); set("runtime.json", report.runtime);
			for(const item of report.reports)
			{
				set(`${item.profile}/report.json`, item); set(`${item.profile}/compiler.json`, item.compiler);
				for(const [index, observation] of item.runs.entries()) set(`${item.profile}/${index ? "relocated" : "installed"}.json`, observation);
			}
			await assert.rejects(checkNominalSubtypeNativeReport(async path => altered.get(path), run)); controls++;
		}
		for(const change of [
			model => { model.exports.find(item => item.name.endsWith(".produceEnvelope")).refinements.result.arguments[0].constructor = "NominalSubtypes.plusOne"; }
			, model => { model.exports.find(item => item.name.endsWith(".produceEnvelope")).refinements.result.arguments[1].bound = "4"; }
			, model => { model.exports.pop(); }
			, model => { model.sourceIdentity.extractorSha256 = "0".repeat(64); }
			, ...run.mode === "full" ? [model => { model.exports.find(item => item.name.endsWith(".second")).refinements.parameters[0].arguments[0].constructor = "NominalSubtypes.plusOne"; }] : []
		]) {
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			for(const attempt of [0, 1])
			{
				const path = `build-${attempt}/model.json`, model = JSON.parse(altered.get(path));
				change(model); const bytes = Buffer.from(canonicalJson(model)); altered.set(path, bytes);
				report.builds[attempt].modelSha256 = sha256(bytes);
			}
			altered.set("report.json", Buffer.from(canonicalJson(report)));
			await assert.rejects(checkNominalSubtypeNativeReport(async path => altered.get(path), run)); controls++;
		}
	}
	t.diagnostic(`${controls} coordinated report and compiler-contract controls`);
});
