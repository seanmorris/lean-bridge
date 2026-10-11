/**
 * Authenticate installed nominal npm records and refuse coordinated false claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalSubtypeNpmReport, nominalSubtypeNpmRecordPaths } from "./nominal-subtype-npm-report.mjs";

const root = "docs/evidence/nominal-subtype-npm-20261011";
const indexSha256 = "34f4069f2ba682bcd29e9a4a2da0fd1483449726f06a5f17a7705b3676b181c0";
const selections = [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]];
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-npm-installed-v1");
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

test("four original nominal npm package selections reproduce, relocate and match exact producer sources", async () => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	for(const source of index.selectedSources)
		assert.deepEqual(files.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit);
		assert.deepEqual(run.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		assert.equal(run.label, `${run.route}/${run.mode}`);
		const read = async path => files.get(`${run.label}/records/${path}`);
		const checked = await checkNominalSubtypeNpmReport(read, run);
		assert.equal(checked.checks, run.mode === "full" ? 3172 : 2078);
		assert.equal(checked.rejections, run.mode === "full" ? 1032 : 0);
		assert.equal(checked.executions, 2); assert.equal(checked.dispatchObserved, false);
		assert.equal(run.reportSha256, sha256(await read("report.json")));
		const prefix = `${run.label}/records/`;
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), nominalSubtypeNpmRecordPaths(run.mode).sort());
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.revision, run.producerCommit); assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
		assert.equal(start.route, run.route); assert.equal(start.mode, run.mode);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished);
		assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]);
		assert.ok(start.initial.freeMiB >= 2048 && start.initial.availableMiB >= 2048 && start.initial.load < 6);
		assert.ok(end.minimum.freeMiB >= 768 && end.minimum.availableMiB >= 768);
		assert.ok(tap.toString().includes(`ok 1 - installed npm nominal Subtypes reproduce and relocate ${run.route} ${run.mode}\n`));
		assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
		assert.equal(start.command, "/usr/bin/nice");
		assert.deepEqual(start.args.slice(0, 8), ["-n", "19", "/usr/bin/ionice", "-c", "3", "/usr/bin/taskset", "-c", "3"]);
		assert.deepEqual(start.args.slice(9), ["--test", "--test-concurrency=1", "tests/helpers/nominal-subtype-npm-installed-tests.mjs"]);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ROUTES, run.route);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_MODES, run.mode);
		assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_OUTPUT, run.prefix + "-records");
		for(const key of ["LEAN_NUM_THREADS", "OMP_NUM_THREADS"]) assert.equal(start.environment[key], "1");
		assert.equal(start.environment.MAKEFLAGS, "-j1");
	}
	const chronological = index.runs.slice().sort((left, right) => left.started.localeCompare(right.started));
	for(let index = 1; index < chronological.length; index++)
		assert.ok(Date.parse(chronological[index - 1].finished) <= Date.parse(chronological[index].started));
});

test("nominal npm archive rejects each missing or corrupted original", async t => {
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

test("nominal npm checker refuses changed choices, false isolation, runtime substitution and lost result-only scope", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = `${run.label}/records/`, originals = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const changes = [
			report => { report.independentBuilds = 1; }
			, report => { report.route = "wrong"; }
			, report => { report.mode = run.mode === "full" ? "result-only" : "full"; }
			, ...["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath", "relocatedInstallation"].map(key => report => { report[key] = false; })
			, report => { report.builds[1].componentArchiveSha256 = "0".repeat(64); }
			, report => { report.expectedBindingIrSha256 = "0".repeat(64); }
			, report => { report.dispatch.observed = true; }
			, report => { report.callers["fixtures/nominal-subtype-consumers/javascript.mjs"] = "0".repeat(64); }
			, report => { delete report.callers["results.mts"]; }
			, report => { report.typescript.skipLibCheck = true; }
			, report => { report.observations.pop(); }
			, report => { report.observations[1].relocated = false; }
			, report => { report.observations[0].result.stdout = '{"checks":1,"rejections":0}\n'; }
			, report => { report.observations[1].typescript.code = 1; }
			, report => { report.observations[1].runtime.stdout = '{"node":"v24.0.0","platform":"linux","arch":"x64"}\n'; }
			, report => { delete report.trees.nominalsubtypes["internal/validators.mjs"]; }
			, report => { report.trees.nominalsubtypes["metadata/binding-ir.json"] = "0".repeat(64); }
			, report => { report.trees.undefined = report.trees.nominalsubtypes; delete report.trees.nominalsubtypes; }
		];
		for(const change of changes)
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			change(report); altered.set("report.json", Buffer.from(canonicalJson(report)));
			for(const [index, observation] of report.observations.entries()) altered.set(`${index ? "relocated" : "installed"}.json`, Buffer.from(canonicalJson(observation)));
			await assert.rejects(checkNominalSubtypeNpmReport(async path => altered.get(path), run)); controls++;
		}
		for(const mutate of [
			adapters => { adapters.exports.find(item => item.bindingId.endsWith(".produceEnvelope")).refinements.result.fields[0].refinement.constructor = "NominalSubtypes.plusOne"; }
			, adapters => { adapters.exports.find(item => item.bindingId.endsWith(".produceEnvelope")).refinements.result.fields[1].refinement.bound = "4"; }
			, adapters => { adapters.exports.pop(); }
			, adapters => { adapters.privateAbi.version = 6; }
			, ...run.mode === "full" ? [adapters => { adapters.exports.find(item => item.bindingId.endsWith(".second")).refinements.parameters[0].fields[0].refinement.constructor = "NominalSubtypes.plusOne"; }] : []
		]) {
			const altered = new Map(originals), adapters = JSON.parse(altered.get("build-0/locks/compiler-adapters.json"));
			mutate(adapters); altered.set("build-0/locks/compiler-adapters.json", Buffer.from(canonicalJson(adapters)));
			await assert.rejects(checkNominalSubtypeNpmReport(async path => altered.get(path), run)); controls++;
		}
	}
	t.diagnostic(`${controls} coordinated claim and compiler-contract controls`);
});
