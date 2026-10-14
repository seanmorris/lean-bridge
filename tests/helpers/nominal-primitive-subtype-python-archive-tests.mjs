/**
 * Reject incomplete or substituted primitive-base Python installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { checkNominalPrimitiveSubtypePythonArchive, nominalPrimitiveSubtypePythonArchive, nominalPrimitiveSubtypePythonArchiveSha256, nominalPrimitiveSubtypePythonProducer, nominalPrimitiveSubtypePythonSelections } from "./nominal-primitive-subtype-python-archive.mjs";
import { checkNominalPrimitiveSubtypePythonControls } from "./nominal-primitive-subtype-python-controls.mjs";

test("primitive-base Python archive reconciles complete wheels and both interpreter floors", async () => {
	const checked = await checkNominalPrimitiveSubtypePythonArchive();
	assert.equal(checked.producerCommit, nominalPrimitiveSubtypePythonProducer);
	assert.deepEqual(checked.installedProfiles, ["python"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(run => [run.route, run.mode]), nominalPrimitiveSubtypePythonSelections);
	for(const run of checked.selections)
	{
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(run.floor, "2.36"); assert.deepEqual(run.minors, ["3.11", "3.12"]);
		assert.equal(run.counts.checks, run.mode === "full" ? 1225 : 587);
		assert.equal(run.counts.rejections, run.mode === "full" ? 283 : 0);
		assert.equal(run.counts.rounds, 256); assert.equal(run.counts.wordBits, 64);
		assert.equal(run.counts.snapshotControls, 9);
		assert.equal(run.executions, 4); assert.equal(run.dispatchObserved, false);
		assert.equal(run.recordControls, run.records * 2);
		assert.equal(run.environmentControls, 44); assert.equal(run.packageControls, 4);
		assert.equal(run.modelControls, run.mode === "full" ? 42 : 23);
		assert.match(run.handoff.archivePath, /^handoff\/archives\/.+\.whl$/u);
	}
	assert.equal(checked.files.filter(file => file.path.endsWith(".whl")).length, 4);
	assert.deepEqual((await nativeArtifactPaths(nominalPrimitiveSubtypePythonArchive)).sort(), ["index.json", ...checked.files.map(file => file.path)].sort());
});

test("primitive-base Python archive refuses missing or changed producer, wheel and environment originals", async () => {
	const index = JSON.parse(await readFile(nominalPrimitiveSubtypePythonArchive + "/index.json"));
	const targets = [
		"index.json", "producer.mjs", "controls-runner.mjs"
		, "sources/src/analyze/NativeExports.lean"
		, "sources/tests/fixtures/nominal-primitive-subtype-consumers/python.py"
		, ...index.runs.flatMap(({ route, mode }) => [
			"producer/start.json", "producer/complete.json", "producer/run.tap"
			, "controls/start.json", "controls/complete.json", "records/report.json"
			, "records/build-0/model.json", "records/wheel.json"
			, "records/3.11/baseline.json", "records/3.12/relocated-process.json"
		].map(path => route + "/" + mode + "/" + path))
		, ...index.files.filter(file => file.path.endsWith(".whl")).map(file => file.path)
	];
	for(const path of targets) for(const missing of [true, false])
		await assert.rejects(checkNominalPrimitiveSubtypePythonArchive(async requested => {
			if(requested !== nominalPrimitiveSubtypePythonArchive + "/" + path) return readFile(requested);
			if(missing) throw new Error("Missing original: " + path);
			return Buffer.concat([await readFile(requested), Buffer.from("changed")]);
		}), undefined, path);
});

test("primitive-base Python archive refuses substituted host, selection and coverage claims", async () => {
	const original = await readFile(nominalPrimitiveSubtypePythonArchive + "/index.json"), index = JSON.parse(original);
	assert.equal(sha256(original), nominalPrimitiveSubtypePythonArchiveSha256);
	const mutations = [
		value => { value.producerCommit = "0".repeat(40); }
		, value => { value.runs.pop(); }, value => { value.runs.reverse(); }
		, value => { value.runs.push(value.runs[0]); }
		, value => { value.runs[0].route = "reviewed"; }
		, value => { value.runs[0].mode = "result-only"; }
		, value => { value.runs[0].runtime.glibc = "2.38"; }
		, value => { value.runs[0].counts.minors.pop(); }
		, value => { value.runs[0].counts.dispatchObserved = true; }
		, value => { value.runs[0].counts.executions = 2; }
		, value => { value.runs[0].tapSha256 = "0".repeat(64); }
		, value => { value.runs[0].reportSha256 = "0".repeat(64); }
		, value => { value.selectedSources.pop(); }, value => { value.files.pop(); }
		, value => { value.files.push(value.files[0]); }
		, value => { value.files[0].path = "../outside"; }
		, value => { value.files[0].sha256 = "0".repeat(64); }
		, value => { value.limitations = []; }
	];
	for(const mutate of mutations)
	{
		const value = structuredClone(index); mutate(value);
		await assert.rejects(checkNominalPrimitiveSubtypePythonArchive(async path => path.endsWith("/index.json") ? Buffer.from(canonicalJson(value)) : readFile(path)));
	}
	assert.deepEqual(await readFile(nominalPrimitiveSubtypePythonArchive + "/index.json"), original);
});

test("primitive-base Python archived originals reject coordinated package and constructor mutations", async () => {
	const original = await readFile(nominalPrimitiveSubtypePythonArchive + "/index.json");
	assert.equal(sha256(original), nominalPrimitiveSubtypePythonArchiveSha256);
	const index = JSON.parse(original);
	for(const run of index.runs)
	{
		const checked = await checkNominalPrimitiveSubtypePythonControls(path => readFile(`${nominalPrimitiveSubtypePythonArchive}/${run.route}/${run.mode}/records/${path}`), run);
		assert.deepEqual(checked, { ...run.counts
			, recordControls: run.counts.records * 2, environmentControls: 44
			, packageControls: 4, modelControls: run.mode === "full" ? 42 : 23 });
	}
});
