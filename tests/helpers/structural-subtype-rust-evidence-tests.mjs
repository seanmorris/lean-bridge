/**
 * Authenticate both Rust author routes; refuse incomplete or altered acceptance claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkStructuralSubtypeRustReport, structuralSubtypeRustRecords } from "./structural-subtype-rust-report.mjs";

const root = "docs/evidence/structural-subtype-rust-20261011";
const indexSha256 = "32ba0d3e41e974f9d44adb6c5dbdbe57d00b04cf89e2c1d3f84d5044d5779aa4";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "structural-subtype-rust-installed-v1");
	assert.deepEqual(index.runs.map(run => run.route), ["ordinary", "reviewed"]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes("..")); assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};

test("structural Rust originals authenticate both installed and relocated selections", async () => {
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
		for(const path of structuralSubtypeRustRecords) assert.ok(files.has(`${run.label}/records/${path}`));
		const read = async path => files.get(`${run.label}/records/${path}`), checked = await checkStructuralSubtypeRustReport(read, run);
		assert.deepEqual(checked, Object.fromEntries(Object.entries(run).filter(([key]) => !["label", "tapSha256", "reportSha256"].includes(key))));
		assert.equal(run.reportSha256, sha256(await read("report.json")));
	}
});

test("structural Rust archive rejects every missing and corrupted original", async t => {
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

test("Rust structural report checker rejects false isolation, toolchain identities and coordinated counts", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = `${run.label}/records/`;
		const originals = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const changes = [
			report => { report.independentBuilds = 1; }
			, ...["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"].map(key => report => { report[key] = false; })
			, ...["offlineInstall", "compilerFreePath"].map(key => report => { report.installed[key] = false; })
			, report => { report.toolchain.rustc.version = "rustc 1.89.0"; }
			, report => { report.toolchain.cargo.sha256 = "invalid"; }
			, report => { report.observations.pop(); }
			, report => { report.observations[1].relocated = false; }
			, report => { report.observations[0].run.code = 1; }
			, report => { report.observations[1].run.stderr = "warning"; }
			, report => { report.observations[1].closure.packageFileSetSha256 = "0".repeat(64); }
			, report => { report.dispatch.observed = true; }
			, report => { report.installed.consumerSha256 = "0".repeat(64); }
			, report => { report.observations[0].closure.receiptSha256 = "0".repeat(64); }
			, report => { report.builds[1].modelSha256 = "0".repeat(64); }
			, ...["checks", "rejections", "snapshotControls"].map(key => report => {
				for(const observation of report.observations)
				{
					observation.counts[key] = 0;
					observation.run.stdout = JSON.stringify(observation.counts) + "\n";
				}
				report.installed.result[key] = 0;
			})
			, report => { report.dependencies.packages.pop(); }
		];
		for(const change of changes)
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			change(report); altered.set("report.json", Buffer.from(canonicalJson(report)));
			for(const [position, observation] of report.observations.entries()) altered.set(`${position ? "relocated" : "installed"}.json`, Buffer.from(canonicalJson(observation)));
			await assert.rejects(checkStructuralSubtypeRustReport(async path => altered.get(path), run)); controls++;
		}
		// Coordinate a forged dependency handoff with its sidecar, but not either original lock.
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			report.dependencies.packages[0].checksum = "0".repeat(64);
			altered.set("dependencies.json", Buffer.from(canonicalJson(report.dependencies)));
			altered.set("report.json", Buffer.from(canonicalJson(report)));
			await assert.rejects(checkStructuralSubtypeRustReport(async path => altered.get(path), run)); controls++;
		}
		for(const path of ["public.rs", "package.Cargo.lock", "consumer.Cargo.lock"])
		{
			const altered = new Map(originals);
			altered.set(path, path === "public.rs" ? Buffer.from("pub fn wrong() {}") : Buffer.from(altered.get(path).toString().replace(/checksum = "[a-f0-9]+"/u, 'checksum = "' + "0".repeat(64) + '"')));
			await assert.rejects(checkStructuralSubtypeRustReport(async name => altered.get(name), run)); controls++;
		}
		const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
		for(const position of [0, 1])
		{
			const path = `build-${position}/model.json`, model = JSON.parse(altered.get(path));
			model.exports.find(item => item.name.endsWith(".arrays")).refinements.parameters[0].arguments[0].constructor = "StructuralSubtypes.normalizePositive";
			const bytes = Buffer.from(canonicalJson(model)); altered.set(path, bytes); report.builds[position].modelSha256 = sha256(bytes);
		}
		altered.set("report.json", Buffer.from(canonicalJson(report)));
		await assert.rejects(checkStructuralSubtypeRustReport(async path => altered.get(path), run)); controls++;
	}
	t.diagnostic(`${controls} coordinated report/contract controls`);
});
