/**
 * Reject incomplete or substituted primitive-base C/C++ installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { checkNominalPrimitiveSubtypeNativeArchive, nominalPrimitiveSubtypeNativeArchive, nominalPrimitiveSubtypeNativeArchiveSha256, nominalPrimitiveSubtypeNativeProducer, nominalPrimitiveSubtypeNativeSelections } from "./nominal-primitive-subtype-native-archive.mjs";
import { checkNominalPrimitiveSubtypeNativeControls } from "./nominal-primitive-subtype-native-controls.mjs";

test("primitive-base native archive reconciles complete C/C++ packages and relocated public callers", async () => {
	const checked = await checkNominalPrimitiveSubtypeNativeArchive();
	assert.equal(checked.producerCommit, nominalPrimitiveSubtypeNativeProducer);
	assert.deepEqual(checked.installedProfiles, ["c", "cpp"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeNativeSelections);
	for(const run of checked.selections)
	{
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
		assert.equal(run.floor, "2.36"); assert.deepEqual(run.profiles, ["c", "cpp"]);
		const full = run.mode === "full";
		assert.deepEqual(run.counts.c, { checks: full ? 3714 : 583, rejections: full ? 306 : 0, rounds: 256, wordBits: 64, snapshotControls: 22 });
		assert.deepEqual(run.counts.cpp, { checks: full ? 1314 : 579, rejections: full ? 306 : 0, rounds: 256, wordBits: 64, snapshotControls: 9 });
		assert.equal(run.executions, 4); assert.equal(run.initialExecutions, 2); assert.equal(run.dispatchObserved, false);
		assert.equal(run.recordControls, (run.route === "ordinary" ? 30 : 32) * 2);
		assert.equal(run.reportControls, 41); assert.equal(run.packageControls, 12);
		assert.equal(run.modelControls, full ? 42 : 23);
		assert.deepEqual(run.packages.map(item => item.profile), ["c", "cpp"]);
	}
	assert.equal(checked.files.filter(file => file.path.endsWith(".tar.gz")).length, 8);
	assert.deepEqual((await nativeArtifactPaths(nominalPrimitiveSubtypeNativeArchive)).sort(), ["index.json", ...checked.files.map(file => file.path)].sort());
});

test("primitive-base native archive refuses missing or changed package and caller originals", async () => {
	const index = JSON.parse(await readFile(nominalPrimitiveSubtypeNativeArchive + "/index.json"));
	const targets = [
		"index.json", "producer.mjs", "controls-runner.mjs", "process-capture.mjs"
		, "sources/src/analyze/NativeExports.lean"
		, ...["c.c", "cpp.cpp"].map(name => "sources/tests/fixtures/nominal-primitive-subtype-consumers/" + name)
		, ...index.runs.flatMap(({ route, mode }) => [
			"producer/start.json", "producer/complete.json", "producer/run.tap"
			, "controls/start.json", "controls/complete.json", "records/report.json"
			, "records/build-0/model.json", "records/build-1/package-set-receipt.json"
			, "records/c/installed.json", "records/cpp/relocated.json"
			, "process/producer.json", "process/producer.log"
			, "process/controls.json", "process/controls.log"
		].map(path => route + "/" + mode + "/" + path))
		, ...index.files.filter(file => file.path.endsWith(".tar.gz")).map(file => file.path)
	];
	for(const path of targets) for(const missing of [true, false])
		await assert.rejects(checkNominalPrimitiveSubtypeNativeArchive(async requested => {
			if(requested !== nominalPrimitiveSubtypeNativeArchive + "/" + path) return readFile(requested);
			if(missing) throw new Error("Missing original: " + path);
			return Buffer.concat([await readFile(requested), Buffer.from("changed")]);
		}), undefined, path);
});

test("primitive-base native archive refuses substituted hosts, selections and coverage claims", async () => {
	const original = await readFile(nominalPrimitiveSubtypeNativeArchive + "/index.json"), index = JSON.parse(original);
	assert.equal(sha256(original), nominalPrimitiveSubtypeNativeArchiveSha256);
	const mutations = [
		value => { value.producerCommit = "0".repeat(40); }
		, value => { value.runs.pop(); }, value => { value.runs.reverse(); }
		, value => { value.runs.push(value.runs[0]); }
		, value => { value.runs[0].route = "reviewed"; }
		, value => { value.runs[0].mode = "result-only"; }
		, value => { value.runs[0].runtime.glibc = "2.38"; }
		, value => { value.runs[0].counts.profiles.pop(); }
		, value => { value.runs[0].counts.dispatchObserved = true; }
		, value => { value.runs[0].counts.executions = 2; }
		, value => { value.runs[0].counts.counts.c.snapshotControls = 9; }
		, value => { value.runs[0].counts.counts.cpp.rejections = 0; }
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
		await assert.rejects(checkNominalPrimitiveSubtypeNativeArchive(async path => path.endsWith("/index.json") ? Buffer.from(canonicalJson(value)) : readFile(path)));
	}
	assert.deepEqual(await readFile(nominalPrimitiveSubtypeNativeArchive + "/index.json"), original);
});

test("primitive-base native archived originals reject coordinated package and constructor mutations", async () => {
	const original = await readFile(nominalPrimitiveSubtypeNativeArchive + "/index.json");
	assert.equal(sha256(original), nominalPrimitiveSubtypeNativeArchiveSha256);
	const index = JSON.parse(original);
	for(const run of index.runs)
	{
		const checked = await checkNominalPrimitiveSubtypeNativeControls(path => readFile(`${nominalPrimitiveSubtypeNativeArchive}/${run.route}/${run.mode}/records/${path}`), run);
		assert.deepEqual(checked, { ...run.counts
			, recordControls: (run.route === "ordinary" ? 30 : 32) * 2
			, reportControls: 41
			, packageControls: 12, modelControls: run.mode === "full" ? 42 : 23 });
	}
});
