/**
 * Authenticate installed structural entry probes without treating them as release measurements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkStructuralSubtypeEntryReport } from "./helpers/structural-subtype-entry-report.mjs";
import "./helpers/structural-subtype-registration-history-tests.mjs";

const root = "docs/evidence/structural-subtype-entry-20261011";
const indexSha256 = "e4945cf2c16e426444523fd70b6f5275f53d1d5a9e17ae4cff0b2e1fc335565f";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map(), originals = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "structural-subtype-native-entry-v1");
	assert.deepEqual(index.runs.map(run => run.route), ["ordinary", "reviewed"]);
	assert.deepEqual(index.attempts.map(attempt => attempt.success), [false, true, true]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes(".."));
		assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
		if(file.compression)
		{
			assert.equal(file.compression, "gzip"); assert.equal(file.path, file.originalPath + ".gz");
			assert.ok(file.originalBytes < 4 * 1024 * 1024);
			const unpacked = gunzipSync(value, { maxOutputLength: 4 * 1024 * 1024 });
			assert.equal(unpacked.length, file.originalBytes); assert.equal(sha256(unpacked), file.originalSha256);
			assert.ok(!originals.has(file.originalPath)); originals.set(file.originalPath, unpacked);
		}
		else
		{ assert.ok(!originals.has(file.path)); originals.set(file.path, value); }
	}
	return { index, files, originals };
};

test("structural entry originals reproduce source probes and both complete installed replays", async () => {
	const { index, originals } = await checkArchive(path => readFile(`${root}/${path}`));
	for(const source of index.selectedSources)
		assert.deepEqual(originals.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	for(const attempt of index.attempts)
	{
		const start = JSON.parse(originals.get(`${attempt.label}/start.json`)), end = JSON.parse(originals.get(`${attempt.label}/end.json`));
		const tap = originals.get(`${attempt.label}/run.tap`);
		assert.equal(start.revision, attempt.producerCommit); assert.equal(start.runnerSha256, sha256(originals.get("runner.mjs")));
		assert.equal(end.tapSha256, sha256(tap)); assert.equal(attempt.tapSha256, end.tapSha256);
		assert.deepEqual([end.code, end.signal, end.diskStop], [attempt.success ? 0 : 1, null, false]);
		assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
		for(const path of attempt.records) assert.ok(originals.has(`${attempt.label}/records/${path}`));
		if(!attempt.success)
		{
			assert.ok(!originals.has(`${attempt.label}/records/report.json`));
			assert.match(tap.toString(), /missing raw symbol lb_tundefined_some/u);
			for(const [path, bytes] of originals) if(path.startsWith(`${attempt.label}/sources/`))
				assert.deepEqual(bytes, execFileSync("git", ["show", `${attempt.producerCommit}:${path.slice(`${attempt.label}/sources/`.length)}`], { maxBuffer: 16 * 1024 * 1024 }));
		}
	}
	for(const run of index.runs)
	{
		const read = async path => originals.get(`${run.route}/records/${path}`);
		const checked = await checkStructuralSubtypeEntryReport(read, run);
		const expected = Object.fromEntries(Object.entries(run).filter(([key]) => !["tapSha256", "reportSha256"].includes(key)));
		assert.deepEqual(checked, expected);
		assert.equal(run.reportSha256, sha256(await read("report.json")));
	}
});

test("structural entry archive rejects every missing and corrupted original including compressed traces", async t => {
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

test("entry checker rejects false scope, isolation, counters, missing markers and weakened observers", async t => {
	const { index, originals } = await checkArchive(path => readFile(`${root}/${path}`));
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = `${run.route}/records/`, records = new Map([...originals].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const changes = [
			report => { report.independentBuilds = 1; }
			, report => { report.scope = report.dispatch.scope = "unmodified-release"; }
			, ...["reproducible", "sourceRemovedBeforeInstallation"].map(key => report => { report[key] = false; })
			, ...["sourceRemovedBeforeInstallation", "compilerFreeReplay", "relocatedInstallation"].map(key => report => { report.dispatch[key] = false; })
			, ...["offlineInstall", "compilerFreePath"].map(key => report => { report.installed[key] = false; })
			, report => { report.dispatch.observations.pop(); }
			, report => { report.dispatch.observations[1].relocated = false; }
			, report => { report.dispatch.selected.pop(); }
			, report => { report.dispatch.observations[0].totals.source = 0; }
			, report => { report.dispatch.observations[1].raw.pop(); }
			, report => { report.dispatch.observations[0].calls--; }
			, report => { report.dispatch.observations[0].checks--; }
			, report => { report.dispatch.observations[1].closure.packageFileSetSha256 = "0".repeat(64); }
			, report => { report.dispatch.unmeasured = []; }
			, report => { delete report.dispatch.observerFiles.raw; }
		];
		for(const change of changes)
		{
			const altered = new Map(records), report = JSON.parse(altered.get("report.json"));
			change(report); altered.set("report.json", Buffer.from(canonicalJson(report)));
			await assert.rejects(checkStructuralSubtypeEntryReport(async path => altered.get(path), run)); controls++;
		}
		for(const marker of ["validator", "constructor", "adapter", "source"])
		{
			const altered = new Map(records), trace = altered.get("installed/corpus.trace").toString();
			const changed = trace.replace(new RegExp(`^LB_SUBTYPE_ENTRY_V1 enter ${marker} [^\\n]+\\n`, "mu"), "");
			assert.notEqual(changed, trace);
			const corpus = JSON.parse(altered.get("installed/corpus.json"));
			corpus.stderrBytes = Buffer.byteLength(changed); corpus.stderrSha256 = sha256(changed);
			const report = JSON.parse(altered.get("report.json")); report.dispatch.observations[0].corpus = corpus;
			altered.set("report.json", Buffer.from(canonicalJson(report)));
			altered.set("installed/corpus.trace", Buffer.from(changed)); altered.set("installed/corpus.json", Buffer.from(canonicalJson(corpus)));
			await assert.rejects(checkStructuralSubtypeEntryReport(async path => altered.get(path), run)); controls++;
		}
		for(const target of ["observer/control.c", "observer/interposer.c", "observer/raw.c"])
		{
			const altered = new Map(records), changed = Buffer.concat([altered.get(target), Buffer.from("/* modified */\n")]);
			const report = JSON.parse(altered.get("report.json")); report.dispatch.observerFiles[target.split("/").at(-1)] = sha256(changed);
			altered.set(target, changed); altered.set("report.json", Buffer.from(canonicalJson(report)));
			await assert.rejects(checkStructuralSubtypeEntryReport(async path => altered.get(path), run)); controls++;
		}
		const altered = new Map(records), commands = JSON.parse(altered.get("observer/commands.json"));
		commands[0].args = commands[0].args.filter(value => value !== "-Werror");
		altered.set("observer/commands.json", Buffer.from(canonicalJson(commands)));
		await assert.rejects(checkStructuralSubtypeEntryReport(async path => altered.get(path), run)); controls++;
	}
	t.diagnostic(`${controls} coordinated report/trace/source controls`);
});
