/**
 * Authenticate installed browser originals and reject incomplete or substituted evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkStructuralSubtypeBrowserReport, structuralSubtypeBrowserRecords } from "./structural-subtype-browser-report.mjs";

const root = "docs/evidence/structural-subtype-browser-20261011";
const indexSha256 = "0b1cabff5ddeb23ea47252a796975901ce65c6d9bcc82867bf043adc28a383e1";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "structural-subtype-browser-installed-v1");
	assert.deepEqual(index.runs.map(run => run.route), ["ordinary", "reviewed"]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes("..")); assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};
const routeRecords = (files, run) => {
	const prefix = `${run.label}/records/`;
	return new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
};
const readRecords = records => async path => {
	assert.ok(records.has(path), "Missing original " + path); return records.get(path);
};
const store = (records, path, value) => records.set(path, Buffer.from(canonicalJson(value)));
const load = (records, path) => JSON.parse(records.get(path));
const mirror = (records, report) => {
	store(records, "browser.json", report);
	for(const row of report.reports)
	{
		store(records, row.profile + "/report.json", row);
		store(records, row.profile + "/observations.json", row.observations);
		store(records, row.profile + "/inputs.json", row.inputs);
	}
};

test("structural browser archive authenticates both author routes and all installed lifecycle observations", async () => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	for(const source of index.selectedSources)
		assert.deepEqual(files.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	for(const run of index.runs)
	{
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.revision, run.producerCommit); assert.equal(start.route, run.route);
		assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
		assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
		assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
		assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_BROWSER_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, "chromium,firefox,webkit");
		assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
		const records = routeRecords(files, run);
		assert.deepEqual([...records.keys()].sort(), [...structuralSubtypeBrowserRecords].sort());
		const checked = await checkStructuralSubtypeBrowserReport(readRecords(records), run);
		assert.deepEqual(checked, Object.fromEntries(Object.entries(run).filter(([key]) => !["label", "tapSha256", "reportSha256"].includes(key))));
		assert.equal(run.reportSha256, sha256(records.get("report.json")));
	}
});

test("structural browser archive rejects every missing and corrupted original", async t => {
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

test("structural browser report requires every original record independently of the archive index", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`)); let controls = 0;
	for(const run of index.runs)
	{
		const originals = routeRecords(files, run);
		for(const path of structuralSubtypeBrowserRecords)
		{
			const records = new Map(originals); records.delete(path);
			await assert.rejects(checkStructuralSubtypeBrowserReport(readRecords(records), run), undefined, path); controls++;
		}
	}
	t.diagnostic(`${controls} missing required record controls`);
});

test("structural browser reports reject coordinated lifecycle, package and caller substitutions", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`)); let controls = 0;
	for(const run of index.runs)
	{
		const originals = routeRecords(files, run), baseline = load(originals, "browser.json");
		const refuse = async mutate => {
			const records = new Map(originals), report = structuredClone(baseline);
			mutate(records, report); mirror(records, report);
			await assert.rejects(checkStructuralSubtypeBrowserReport(readRecords(records), run)); controls++;
		};
		for(const mutate of [report => { report.reports.pop(); }
			, report => { report.reports[1] = report.reports[0]; }
			, report => { report.requestedEngines.pop(); }
			, report => { report.route = "invented"; }
			, report => { report.producerCommit = "0".repeat(40); }
			, report => { report.dispatchObserved = true; }]) await refuse((_records, report) => mutate(report));
		for(const index of baseline.reports.keys())
		{
			const mutations = [
				...["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"].map(key => row => { row[key] = false; })
				, ...["bindingIrSha256", "receiptSha256", "corpusSha256", "packageSourceSha256"].map(key => row => { row[key] = "0".repeat(64); })
				, row => { row.browser.installedSourcesRemoved = false; }
				, row => { row.browser.externalNetworkBlocked = false; }
				, row => { row.browser.requestedEngines.pop(); }
				, row => { row.browser.executions.pop(); }
				, row => { row.observations.pop(); }
				, row => { row.observations[0].observation.results.checks--; }
				, row => { row.observations[0].observation.results.rejections--; }
				, row => { row.observations[0].observation.realm = "wrong"; }
				, row => { row.observations[0].observation.hostVersion = ""; }
				, row => { row.observations[0].engine = "unknown"; }
				, row => { row.observations[0].phase = "first-copy"; }
				, row => { row.browser.executions[0].failedAssetRecovery = false; }
				, row => { row.browser.executions[0].assets.pop(); }
				, row => { row.browser.executions[0].assets[0].status = 404; }
				, row => { row.browser.executions[0].assets[0].bytes--; }
				, row => { row.browser.executions[0].assets[0].mime = "text/plain"; }
				, row => { row.browser.executions[0].lifecycle = {}; }
				, row => { row.browser.installedAssets[0].sha256 = "0".repeat(64); }
				, row => { row.browser.deployments[0].modulePaths = []; }
				, row => { row.inventedEvidence = true; }
				, row => {
					row.browser.deployments[0].files.find(file => file.path.endsWith(".wasm")).sha256 = "0".repeat(64);
					row.browser.deployments[0].sha256 = sha256(canonicalJson(row.browser.deployments[0].files));
				}
			];
			if(baseline.reports[index].profile === "browser-react") mutations.push(row => { row.browser.executions[0].pendingUnmount = false; });
			for(const mutate of mutations) await refuse((_records, report) => mutate(report.reports[index]));
			for(const name of ["javascript.mjs", "index.html", "package.mjs", "check.mjs"])
				await refuse((records, report) => {
					const row = report.reports[index], bytes = Buffer.from("invented caller returning expected counts\n");
					records.set(row.profile + "/" + name, bytes);
					row.inputs[name] = { bytes: bytes.length, sha256: sha256(bytes) };
				});
			for(const [name, mutate] of [
				["installed-runtime-identity.json", value => { value.files.find(file => file.path === "internal/main.wasm").sha256 = "0".repeat(64); }]
				, ["installed-runtime-package.json", value => { value.version = "1.0.0"; }]
				, ["installed-component-package.json", value => { value.leanBridge.bindingIrSha256 = "0".repeat(64); }]
				, ["installed-component-package.json", value => { value.dependencies["@lean-bridge/runtime"] = "*"; }]
				, ["installed-component-package.json", value => { value.exports["."].browser = "./other.mjs"; }]
				, ["package-lock.json", value => { value.packages["node_modules/structuralsubtypes"].version = "999.0.0"; }]
			]) await refuse((records, report) => {
				const row = report.reports[index], path = row.profile + "/" + name, value = load(records, path);
				const before = canonicalJson(value); mutate(value);
				assert.notEqual(canonicalJson(value), before, `Mutation must alter ${path}`);
				store(records, path, value);
				if(row.inputs[name]) row.inputs[name] = { bytes: records.get(path).length, sha256: sha256(records.get(path)) };
			});
		}
	}
	t.diagnostic(`${controls} coordinated report and package controls`);
});
