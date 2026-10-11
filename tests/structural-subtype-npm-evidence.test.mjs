/**
 * Authenticate installed structural Subtype npm records and refuse altered acceptance claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkStructuralSubtypeNpmReport } from "./helpers/structural-subtype-npm-report.mjs";

const root = "docs/evidence/structural-subtype-npm-20261011";
const indexSha256 = "24b189f8e95f6eefb1090c8766e666507ea52afe14dc3b66aaad2a2534069213";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "structural-subtype-npm-installed-v1");
	assert.deepEqual(index.runs.map(run => run.route), ["ordinary", "reviewed"]);
	assert.deepEqual(index.attempts.map(attempt => attempt.success), [false, false, true, true]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes(".."));
		assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};

test("original npm failures and successful ordinary/reviewed installed replays match exact producer sources", async () => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	for(const source of index.selectedSources)
		assert.deepEqual(files.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	for(const attempt of index.attempts)
	{
		const start = JSON.parse(files.get(`${attempt.label}/start.json`)), end = JSON.parse(files.get(`${attempt.label}/end.json`));
		const tap = files.get(`${attempt.label}/run.tap`);
		assert.equal(start.revision, attempt.producerCommit); assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
		assert.equal(end.tapSha256, sha256(tap)); assert.equal(attempt.tapSha256, end.tapSha256);
		assert.deepEqual([end.code, end.signal, end.diskStop], [attempt.success ? 0 : 1, null, false]);
		assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
		for(const path of attempt.records) assert.ok(files.has(`${attempt.label}/records/${path}`));
		if(!attempt.success)
		{
			assert.ok(!files.has(`${attempt.label}/records/report.json`));
			for(const [path, bytes] of files) if(path.startsWith(`${attempt.label}/sources/`))
				assert.deepEqual(bytes, execFileSync("git", ["show", `${attempt.producerCommit}:${path.slice(`${attempt.label}/sources/`.length)}`], { maxBuffer: 16 * 1024 * 1024 }));
		}
	}
	for(const run of index.runs)
	{
		const read = async path => files.get(`${run.route}/records/${path}`);
		const checked = await checkStructuralSubtypeNpmReport(read, run);
		assert.equal(checked.checks, 3028); assert.equal(checked.rejections, 1020);
		assert.equal(checked.executions, 2); assert.equal(checked.dispatchObserved, false);
		assert.equal(run.reportSha256, sha256(await read("report.json")));
	}
});

test("structural npm archive rejects each missing or corrupted original", async t => {
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

test("structural npm checker refuses false isolation, changed contracts, counts and dispatch claims", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = `${run.route}/records/`, originals = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const changes = [
			report => { report.independentBuilds = 1; }
			, ...["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath", "relocatedInstallation"].map(key => report => { report[key] = false; })
			, report => { report.builds[1].componentArchiveSha256 = "0".repeat(64); }
			, report => { report.expectedBindingIrSha256 = "0".repeat(64); }
			, report => { report.dispatch.observed = true; }
			, report => { report.corpusSha256 = "0".repeat(64); }
			, report => { report.typescript.skipLibCheck = true; }
			, report => { report.observations.pop(); }
			, report => { report.observations[1].relocated = false; }
			, report => { report.observations[0].result.stdout = '{"checks":1,"rejections":0}\n'; }
			, report => { report.observations[1].typescript.code = 1; }
			, report => { delete report.trees.structuralsubtypes["internal/validators.mjs"]; }
			, report => { report.trees.structuralsubtypes["metadata/binding-ir.json"] = "0".repeat(64); }
			, report => { report.trees.undefined = report.trees.structuralsubtypes; delete report.trees.structuralsubtypes; }
		];
		for(const change of changes)
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			change(report); altered.set("report.json", Buffer.from(canonicalJson(report)));
			for(const [index, observation] of report.observations.entries()) altered.set(`${index ? "relocated" : "installed"}.json`, Buffer.from(canonicalJson(observation)));
			await assert.rejects(checkStructuralSubtypeNpmReport(async path => altered.get(path), run)); controls++;
		}
		const altered = new Map(originals), adapters = JSON.parse(altered.get("build-0/locks/compiler-adapters.json"));
		adapters.exports.find(item => item.bindingId.endsWith(".arrays")).refinements.parameters[0].arguments[0].constructor = "StructuralSubtypes.normalizePositive";
		altered.set("build-0/locks/compiler-adapters.json", Buffer.from(canonicalJson(adapters)));
		await assert.rejects(checkStructuralSubtypeNpmReport(async path => altered.get(path), run)); controls++;
	}
	t.diagnostic(`${controls} coordinated claim and compiler-contract controls`);
});
