/**
 * Authenticate both Perl author routes; refuse incomplete or altered acceptance claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkStructuralSubtypePerlReport, structuralSubtypePerlRecords } from "./structural-subtype-perl-report.mjs";

const root = "docs/evidence/structural-subtype-perl-20261011";
const indexSha256 = "5809c2236f123b9bebb1a4ab8d7cc28b5ecdbbca2eb5be9c9706cc2848238030";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "structural-subtype-perl-installed-v1");
	assert.deepEqual(index.runs.map(run => run.route), ["ordinary", "reviewed"]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes("..")); assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};

test("structural Perl originals authenticate both installed and relocated selections", async () => {
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
		assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
		for(const path of structuralSubtypePerlRecords(run.route)) assert.ok(files.has(`${run.label}/records/${path}`));
		const read = async path => files.get(`${run.label}/records/${path}`), checked = await checkStructuralSubtypePerlReport(read, run);
		assert.deepEqual(checked, Object.fromEntries(Object.entries(run).filter(([key]) => !["label", "tapSha256", "reportSha256"].includes(key))));
		assert.equal(run.reportSha256, sha256(await read("report.json")));
	}
});

test("structural Perl archive rejects every missing and corrupted original", async t => {
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

test("Perl structural reports reject omitted ABIs, false isolation and coordinated package changes", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = `${run.label}/records/`;
		const originals = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const store = (altered, path, value) => altered.set(path, Buffer.from(canonicalJson(value)));
		const load = (altered, path) => JSON.parse(altered.get(path));
		const mutations = [
			(_altered, report) => { report.configurations.pop(); }
			, (_altered, report) => { report.modes.pop(); }
			, (_altered, report) => { report.reports.pop(); }
			, (_altered, report) => { report.interpreters.pop(); }
			, (_altered, report) => { report.reports[1] = report.reports[0]; }
			, (_altered, report) => { report.reproducible = false; }
			, (_altered, report) => { report.sourceRemovedBeforeInstallation = false; }
			, (_altered, report) => { report.producerCommit = "0".repeat(40); }
			, (_altered, report) => { report.glibcMinimumVersion = "2.17"; }
			, (_altered, report) => { report.builds[1].modelSha256 = "0".repeat(64); }
			, (_altered, report) => { report.interpreters[0].identity.version = "5.34.0"; report.reports[0].identity.version = "5.34.0"; }
			, ...["offlineInstall", "compilerFreeExecution", "leanCompilerUnavailable", "extractedDistributionsRemoved", "nativePayloadUnchanged", "installedBytesUnchanged", "relocatedInstallation", "compilerFreeReplay", "sourceUnchangedAfterReplay"].map(key => (_altered, report) => { report.reports[0][key] = false; })
			, (_altered, report) => { report.reports[0].dispatch.observed = true; }
			, (_altered, report) => { report.reports[0].repeatedRuns = 1; }
			, (_altered, report) => { report.reports[0].installationCCompilerAvailable = true; }
			, ...["checks", "rejections", "snapshotControls"].map(key => (altered, report) => {
				for(const item of report.reports)
				{
					item[key] = 0;
					for(const name of ["first.stdout", "repeated.stdout"])
					{
						const path = `${item.configuration}/${item.mode}/${name}`, counts = load(altered, path);
						counts[key] = 0; store(altered, path, counts);
					}
				}
			})
			, ...["module", "nativeRuntimeIdentity", "prebuilt", "source"].map(field => (altered, report) => {
				const item = report.reports[0], base = `${item.configuration}/${item.mode}/`;
				const manifest = load(altered, base + "component-manifest.json");
				if(field === "module") manifest.module = "LeanBridge::Other";
				if(field === "nativeRuntimeIdentity") manifest.nativeRuntimeIdentity = "0".repeat(64);
				if(field === "prebuilt") manifest.prebuilt.pop();
				if(field === "source") altered.set(base + "component-source.xs", Buffer.from("changed XS"));
				store(altered, base + "component-manifest.json", manifest);
				item.traces[1].manifestSha256 = sha256(canonicalJson(manifest));
			})
			, ...["operation", "abi", "payload", "output"].map(field => (altered, report) => {
				const item = report.reports[0], base = `${item.configuration}/${item.mode}/`;
				const receipt = load(altered, base + "component-install-receipt.json");
				const trace = load(altered, base + "component-trace.json");
				if(field === "operation") receipt.operation = trace.operation = "generated-xs-only";
				if(field === "abi") receipt.abi.ptrsize = "4";
				if(field === "payload") trace.nativePayloadUnchanged = false;
				if(field === "output") receipt.outputSha256 = "0".repeat(64);
				store(altered, base + "component-install-receipt.json", receipt);
				store(altered, base + "component-trace.json", trace);
				item.traces[1].receiptSha256 = sha256(canonicalJson(receipt));
				item.traces[1].traceSha256 = sha256(canonicalJson(trace));
			})
			, ...["constructor", "Fin", "source", "request"].map(field => (altered, report) => {
				for(const attempt of [0, 1])
				{
					const path = `build-${attempt}/model.json`, model = load(altered, path);
					if(field === "constructor") model.exports.find(item => item.name === "StructuralSubtypes.aliasPair").refinements.parameters[0].arguments[1].arguments[0].arguments[0].constructor = "StructuralSubtypes.checkedPositive";
					if(field === "Fin") model.exports.find(item => item.name === "StructuralSubtypes.nested").refinements.parameters[0].arguments[0].arguments[0].arguments[0].arguments[1].bound = "10";
					if(field === "source") model.sourceIdentity.modules[0].source.sha256 = "0".repeat(64);
					if(field === "request") model.sourceIdentity.request.contracts = {};
					store(altered, path, model); report.builds[attempt].modelSha256 = sha256(canonicalJson(model));
				}
			})
		];
		for(const mutate of mutations)
		{
			const altered = new Map(originals), report = load(altered, "report.json");
			mutate(altered, report);
			store(altered, "report.json", report);
			for(const item of report.reports) store(altered, `${item.configuration}/${item.mode}/report.json`, item);
			await assert.rejects(checkStructuralSubtypePerlReport(async path => altered.get(path), run));
			controls++;
		}
	}
	t.diagnostic(`${controls} coordinated report and package controls`);
});
