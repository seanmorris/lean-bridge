/**
 * Authenticate original nominal Perl executions and reject false combined claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { checkNominalSubtypePerlReport, nominalSubtypePerlRecords } from "./nominal-subtype-perl-report.mjs";
import { nominalSubtypePerlSafePath } from "./nominal-subtype-perl-package-records.mjs";
import { nominalSubtypePerlOriginal, nominalSubtypePerlGenerator } from "./nominal-subtype-perl-generators.mjs";
import { assertNominalSubtypePerlRun, nominalSubtypePerlSelections } from "./nominal-subtype-perl-provenance.mjs";
import { nominalSubtypePerlPackageControls } from "./nominal-subtype-perl-package-controls.mjs";

const root = "docs/evidence/nominal-subtype-perl-20261012";
const indexSha256 = "6d893820aed83eedaff7f56d4b93c7f3a5aaaf31fc26f94b8c1aa8039c4c8b60";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.ok(bytes.toString() === canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-perl-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypePerlSelections);
	for(const file of index.files)
	{
		nominalSubtypePerlSafePath(file.path); assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};
const load = () => checkArchive(path => readFile(`${root}/${path}`));
const selectionFiles = (files, run) => {
	const prefix = `${run.label}/records/`;
	return new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
};

test("nominal Perl archive authenticates four selections, both author roots and 64 installed executions", async () => {
	const { index, files } = await load();
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...files.keys(), "index.json"].sort());
	for(const path of index.selectedSources)
		assert.equal(sha256(files.get(`sources/${path}`)), sha256(nominalSubtypePerlOriginal(index.producerCommit, path)));
	assert.deepEqual(index.generatorClosure, (await nominalSubtypePerlGenerator(index.producerCommit)).paths);
	assert.ok(index.generatorClosure.every(path => index.selectedSources.includes(path)));
	let executions = 0, checks = 0, rejections = 0;
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		const originals = selectionFiles(files, run);
		assert.deepEqual([...originals.keys()].sort(), nominalSubtypePerlRecords(run.route).sort());
		const checked = await checkNominalSubtypePerlReport(async path => originals.get(path), run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		assert.equal(run.reportSha256, sha256(originals.get("report.json")));
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(run.tapSha256, sha256(tap));
		assertNominalSubtypePerlRun({ ...run, start, end, tap, runner: files.get("runner.mjs") });
		executions += checked.executions; checks += checked.executions * checked.counts.checks;
		rejections += checked.executions * checked.counts.rejections;
	}
	assert.equal(executions, 64); assert.equal(checks, 201536); assert.equal(rejections, 33024);
	for(let position = 1; position < index.runs.length; position++)
		assert.ok(Date.parse(index.runs[position - 1].finished) <= Date.parse(index.runs[position].started));
});

test("nominal Perl archive refuses every missing or corrupted original", async t => {
	const { files } = await load(); files.set("index.json", await readFile(`${root}/index.json`));
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

test("nominal Perl provenance refuses altered gates, incomplete TAP and resource stops", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const originalStart = JSON.parse(files.get(`${run.label}/start.json`)), originalEnd = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`), runner = files.get("runner.mjs");
		const changes = [
			start => { start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_PERL_TEST = "0"; }
			, start => { start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_PERL_MODES = "full,result-only"; }
			, start => { start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_PERL_ROUTES = "ordinary,reviewed"; }
			, start => { start.environment.LEAN_NUM_THREADS = "8"; }
			, start => { start.initial.freeMiB = 100; }
			, start => { start.initial.availableMiB = 100; }
			, start => { start.initial.load = 8; }
			, start => { start.runnerSha256 = "0".repeat(64); }
			, start => { start.revision = "0".repeat(40); }
			, start => { start.args[1] = "0"; }
			, (_, end) => { end.code = 1; }
			, (_, end) => { end.signal = "SIGTERM"; }
			, (_, end) => { end.stopReason = "disk-floor"; }
			, (_, end) => { end.minimum.freeMiB = 767; }
			, (_, end) => { end.minimum.availableMiB = 767; }
			, (_, end) => { end.error = "failed"; }
			, (start, end) => { end.finished = new Date(Date.parse(start.started) - 1).toISOString(); }
		];
		for(const change of changes)
		{
			const start = structuredClone(originalStart), end = structuredClone(originalEnd); change(start, end);
			assert.throws(() => assertNominalSubtypePerlRun({ ...run, start, end, tap, runner })); controls++;
		}
		for(const text of [tap.toString().replace("# pass 1", "# pass 0"), tap.toString().replace("# skipped 0", "# skipped 1"), tap.toString().replace("ok 1 -", "not ok 1 -")])
		{
			const altered = Buffer.from(text), end = { ...originalEnd, tapSha256: sha256(altered) };
			assert.throws(() => assertNominalSubtypePerlRun({ ...run, start: originalStart, end, tap: altered, runner })); controls++;
		}
	}
	t.diagnostic(`${controls} coordinated provenance controls`);
});

test("nominal Perl checker rejects coordinated false replay and compiler decisions", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs)
	{
		const originals = selectionFiles(files, run);
		const flags = ["offlineInstall", "compilerFreeExecution"
			, "leanCompilerUnavailable", "extractedDistributionsRemoved"
			, "nativePayloadUnchanged", "installedBytesUnchanged"
			, "relocatedInstallation", "compilerFreeReplay"
			, "sourceUnchangedAfterReplay"];
		const changes = [
			report => { report.independentBuilds = 1; }
			, report => { report.mode = run.mode === "full" ? "result-only" : "full"; }
			, report => { report.declaredGlibcFloor = "2.38"; }
			, report => { report.runtime.glibc.stdout = "glibc 2.38\n"; }
			, report => { report.configurations.pop(); }
			, report => { report.deliveryModes.pop(); }
			, ...["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation"].map(key => report => { report[key] = false; })
			, ...[0, 7].flatMap(position => [
				report => { report.reports[position].checks = 1; }
				, report => { report.reports[position].rejections++; }
				, report => { report.reports[position].snapshotControls = 0; }
				, report => { report.reports[position].dispatch.observed = true; }
				, report => { report.reports[position].consumerSha256 = "0".repeat(64); }
				, report => { report.reports[position].arguments.push("--skip-rejections"); }
				, report => { report.reports[position].repeatedRuns = 1; }
				, ...flags.map(key => report => { report.reports[position][key] = false; })
			])
		];
		for(const change of changes)
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json")); change(report);
			const set = (path, value) => altered.set(path, Buffer.from(canonicalJson(value)));
			set("report.json", report); set("runtime.json", report.runtime);
			for(const item of report.reports) set(`${item.configuration}/${item.delivery}/report.json`, item);
			await assert.rejects(checkNominalSubtypePerlReport(async path => altered.get(path), run)); controls++;
		}
		const modelChanges = [
			model => { model.exports.find(item => item.name.endsWith(".produceEnvelope")).refinements.result.arguments[0].constructor = "NominalSubtypes.plusOne"; }
			, model => { model.exports.find(item => item.name.endsWith(".produceEnvelope")).refinements.result.arguments[1].bound = "4"; }
			, model => { model.exports.pop(); }
			, model => { model.sourceIdentity.extractorSha256 = "0".repeat(64); }
			, ...run.mode === "full" ? [model => { model.exports.find(item => item.name.endsWith(".second")).refinements.parameters[0].arguments[0].constructor = "NominalSubtypes.plusOne"; }] : []
		];
		for(const change of modelChanges)
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			for(const attempt of [0, 1])
			{
				const path = `build-${attempt}/model.json`, model = JSON.parse(altered.get(path)); change(model);
				const bytes = Buffer.from(canonicalJson(model)); altered.set(path, bytes); report.builds[attempt].modelSha256 = sha256(bytes);
			}
			altered.set("report.json", Buffer.from(canonicalJson(report)));
			await assert.rejects(checkNominalSubtypePerlReport(async path => altered.get(path), run)); controls++;
		}
		for(const item of JSON.parse(originals.get("report.json")).reports)
		{
			for(const name of ["first.json", "repeated.json"])
			{
				const path = `${item.configuration}/${item.delivery}/${name}`;
				for(const change of [value => { value.code = 1; }, value => { value.stderr = "warning\n"; }, value => { value.stdout = '{"checks":1,"rejections":0,"snapshotControls":0}\n'; }])
				{
					const altered = new Map(originals), value = JSON.parse(altered.get(path)); change(value);
					altered.set(path, Buffer.from(canonicalJson(value)));
					await assert.rejects(checkNominalSubtypePerlReport(async path => altered.get(path), run)); controls++;
				}
			}
		}
	}
	t.diagnostic(`${controls} coordinated report, model and execution controls`);
});

test("nominal Perl checker rejects API substitutions with recomputed manifest and installation hashes", async t => {
	const { index, files } = await load(); let controls = 0;
	for(const run of index.runs) controls += await nominalSubtypePerlPackageControls(selectionFiles(files, run), run);
	t.diagnostic(`${controls} coordinated package, ABI and generated API controls`);
});
