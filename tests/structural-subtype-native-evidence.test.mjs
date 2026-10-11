/**
 * Authenticate original structural Subtype installed records and reject narrowed claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkStructuralSubtypeNativeReport } from "./helpers/structural-subtype-native-report.mjs";

const root = "docs/evidence/structural-subtype-native-20261011";
const indexSha256 = "d67872f878db83b7ba1c6992b7d014a31738505b32ae6edd1d32675f5bd6c292";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "structural-subtype-native-installed-v1");
	assert.deepEqual(index.runs.map(run => run.route), ["ordinary", "reviewed"]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes(".."));
		assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};

test("structural Subtype C/C++ originals authenticate both source routes and exact Git producer sources", async () => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	for(const source of index.selectedSources)
		assert.deepEqual(files.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	for(const run of index.runs)
	{
		const read = async path => files.get(`${run.route}/records/${path}`);
		const checked = await checkStructuralSubtypeNativeReport(read, run);
		assert.deepEqual(checked.checks, [4049, 4047]); assert.equal(checked.dispatchObserved, false);
		const start = JSON.parse(files.get(`${run.route}/start.json`)), end = JSON.parse(files.get(`${run.route}/end.json`));
		assert.equal(start.revision, index.producerCommit); assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
		assert.equal(end.tapSha256, sha256(files.get(`${run.route}/run.tap`))); assert.equal(run.tapSha256, end.tapSha256);
		assert.equal(run.reportSha256, sha256(await read("report.json")));
		assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
		assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
	}
});

test("structural Subtype archive rejects every missing or corrupted original", async () => {
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
});

test("structural Subtype record checker refuses coordinated claim and execution mutations", async () => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	for(const run of index.runs)
	{
		const originals = new Map([...files].filter(([path]) => path.startsWith(`${run.route}/records/`)).map(([path, value]) => [path.slice(`${run.route}/records/`.length), value]));
		const changes = [
			report => { report.reproducible = false; }
			, report => { report.independentBuilds = 1; }
			, report => { report.declaredGlibcFloor = "unknown"; }
			, report => { report.profiles.pop(); }
			, report => { report.expectedBindingIrSha256 = "0".repeat(64); }
			, report => { report.builds[1].modelSha256 = "0".repeat(64); }
			, ...["compilerFreePath", "compilerFreeReplay", "offlineInstall", "relocatedInstallation", "sourceRemovedBeforeInstallation"].map(key => report => { report.reports[0][key] = false; })
			, report => { report.reports[1].dispatch.observed = true; }
			, report => { report.reports[0].checks--; }
			, report => { report.reports[0].runs[1].stdout = "structural-subtype-ok:1\n"; }
			, report => { report.reports[0].runs[1].relocated = false; }
			, report => { report.reports[0].runs[1].receiptSha256 = "0".repeat(64); }
		];
		for(const change of changes)
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			change(report); altered.set("report.json", Buffer.from(canonicalJson(report)));
			for(const item of report.reports)
			{
				altered.set(`${item.profile}/report.json`, Buffer.from(canonicalJson(item)));
				item.runs.forEach((observation, index) => altered.set(`${item.profile}/${index ? "relocated" : "installed"}.json`, Buffer.from(canonicalJson(observation))));
			}
			await assert.rejects(checkStructuralSubtypeNativeReport(async path => altered.get(path), run));
		}
	}
});
