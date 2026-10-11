/**
 * Authenticate both WIT author routes; refuse incomplete or altered acceptance claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkStructuralSubtypeWitReport, structuralSubtypeWitRecords } from "./structural-subtype-wit-report.mjs";

const root = "docs/evidence/structural-subtype-wit-20261011";
const indexSha256 = "c630598ad8ecedce13f1bc7b469dc416ff615d53cd8c82486c5c98b15280ba9f";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "structural-subtype-wit-installed-v1");
	assert.deepEqual(index.runs.map(run => run.route), ["ordinary", "reviewed"]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes("..")); assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};

test("structural WIT originals authenticate both installed and relocated selections", async () => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	for(const source of index.selectedSources)
		assert.deepEqual(files.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	for(const source of index.failed.sources)
		assert.deepEqual(files.get(`failed/sources/${source}`), execFileSync("git", ["show", `${index.failed.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	const failedStart = JSON.parse(files.get("failed/start.json")), failedEnd = JSON.parse(files.get("failed/end.json"));
	assert.equal(failedStart.revision, index.failed.producerCommit);
	assert.equal(failedEnd.tapSha256, sha256(files.get("failed/run.tap")));
	assert.equal(index.failed.tapSha256, failedEnd.tapSha256);
	assert.deepEqual([failedEnd.code, failedEnd.signal, failedEnd.diskStop], [1, null, false]);
	assert.match(files.get("failed/run.tap").toString(), /# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n/u);
	for(const path of index.failed.records) assert.ok(files.has("failed/records/" + path));
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
		for(const path of structuralSubtypeWitRecords) assert.ok(files.has(`${run.label}/records/${path}`));
		const read = async path => files.get(`${run.label}/records/${path}`), checked = await checkStructuralSubtypeWitReport(read, run);
		assert.deepEqual(checked, Object.fromEntries(Object.entries(run).filter(([key]) => !["label", "tapSha256", "reportSha256"].includes(key))));
		assert.equal(run.reportSha256, sha256(await read("report.json")));
	}
});

test("structural WIT archive rejects every missing and corrupted original", async t => {
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


test("WIT structural reports reject false relocation, changed transport and coordinated Wasmtime substitutions", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = `${run.label}/records/`;
		const originals = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const save = (altered, report) => {
			altered.set("report.json", Buffer.from(canonicalJson(report)));
			for(const [position, observation] of report.observations.entries())
				altered.set(`${position ? "relocated" : "installed"}.json`, Buffer.from(canonicalJson(observation)));
		};
		const changes = [
			report => { report.independentBuilds = 1; }
			, ...["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"].map(key => report => { report[key] = false; })
			, ...["offlineInstall", "compilerFreePath"].map(key => report => { report.installed[key] = false; })
			, report => { report.executable.runtimeSearchPath = "/tmp/old-root/lib"; }
			, report => { report.executable.runtimeSearchPath += ":/tmp/old-root/lib"; }
			, report => { report.executable.executableSha256 = ""; }
			, report => { report.observations.pop(); }
			, report => { report.observations[1].relocated = false; }
			, report => { report.observations[0].run.code = 1; }
			, report => { report.observations[1].run.stderr = "warning"; }
			, report => { report.observations[1].closure.receiptSha256 = "0".repeat(64); }
			, report => { report.dispatch.observed = true; }
			, report => { report.installed.consumerSha256 = "0".repeat(64); }
			, report => { report.builds[1].modelSha256 = "0".repeat(64); }
			, ...["checks", "rejections", "snapshotControls"].map(key => report => {
				for(const observation of report.observations)
				{
					observation.counts[key] = 0;
					observation.run.stdout = JSON.stringify(observation.counts) + "\n";
				}
				report.installed.result[key] = 0;
				if(key === "checks") report.installed.checks = 0;
			})
		];
		for(const change of changes)
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			change(report); save(altered, report);
			await assert.rejects(checkStructuralSubtypeWitReport(async path => altered.get(path), run)); controls++;
		}
		for(const mutation of ["signature", "manifest", "absolute-pkgconfig", "component", "wasmtime-version", "wasmtime-library", "missing-library"])
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			const receipt = JSON.parse(altered.get("installed-receipt.json"));
			const adapter = JSON.parse(altered.get("package/native-wit-adapter.json"));
			const replace = (path, bytes) => {
				altered.set("package/" + path, bytes);
				const entry = { bytes: bytes.length, sha256: sha256(bytes) };
				receipt.files[path] = entry;
				if(Object.hasOwn(adapter.files, path)) adapter.files[path] = entry;
			};
			if(mutation === "signature")
				replace("wit/structuralsubtypes.wit", Buffer.from("package invented:unrelated;"));
			if(mutation === "manifest")
			{
				const manifest = JSON.parse(altered.get("package/binding-manifest.json"));
				manifest.component = "lean:unrelated";
				replace("binding-manifest.json", Buffer.from(canonicalJson(manifest)));
			}
			if(mutation === "absolute-pkgconfig")
				replace("lib/pkgconfig/structuralsubtypes-wit.pc", Buffer.from("prefix=/tmp/old-root\n"));
			if(mutation === "component")
			{
				const component = Buffer.from(altered.get("package/component/structuralsubtypes.wasm"));
				component[4] = 1; replace("component/structuralsubtypes.wasm", component); receipt.componentSha256 = sha256(component);
			}
			if(mutation === "wasmtime-version")
			{ adapter.wasmtime.version = "43.0.0"; receipt.wasmtime = "43.0.0"; }
			if(mutation === "wasmtime-library")
			{
				const path = "lib/libwasmtime.so", entry = { bytes: 1, sha256: "0".repeat(64) };
				receipt.files[path] = entry; adapter.files["wasmtime/" + path] = entry; adapter.wasmtime.files[path] = entry;
				adapter.wasmtime.filesSha256 = sha256(canonicalJson(adapter.wasmtime.files));
			}
			if(mutation === "missing-library")
			{
				delete receipt.files["lib/libstructuralsubtypes_wasmtime.so"];
				delete adapter.files["lib/libstructuralsubtypes_wasmtime.so"];
			}
			const adapterBytes = Buffer.from(canonicalJson(adapter));
			replace("native-wit-adapter.json", adapterBytes);
			const receiptBytes = Buffer.from(canonicalJson(receipt)); altered.set("installed-receipt.json", receiptBytes);
			for(const observation of report.observations)
			{
				observation.closure.receiptSha256 = sha256(receiptBytes);
				observation.closure.packageFileSetSha256 = sha256(canonicalJson([...Object.keys(receipt.files), "lean-bridge-package.json"].sort()));
			}
			save(altered, report);
			await assert.rejects(checkStructuralSubtypeWitReport(async path => altered.get(path), run)); controls++;
		}
		const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
		for(const position of [0, 1])
		{
			const path = `build-${position}/model.json`, model = JSON.parse(altered.get(path));
			model.exports.find(item => item.name.endsWith(".arrays")).refinements.parameters[0].arguments[0].constructor = "StructuralSubtypes.normalizePositive";
			const bytes = Buffer.from(canonicalJson(model)); altered.set(path, bytes); report.builds[position].modelSha256 = sha256(bytes);
		}
		save(altered, report);
		await assert.rejects(checkStructuralSubtypeWitReport(async path => altered.get(path), run)); controls++;
	}
	t.diagnostic(`${controls} coordinated report/contract controls`);
});
