/**
 * Keep primitive-base nominal npm evidence tied to all four original installed selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { nominalPrimitiveSubtypeNpmArchive, nominalPrimitiveSubtypeNpmArchiveSha256, nominalPrimitiveSubtypeNpmProducer, nominalPrimitiveSubtypeNpmSelections, checkNominalPrimitiveSubtypeNpmArchive } from "./nominal-primitive-subtype-npm-archive.mjs";
import { checkNominalPrimitiveSubtypeNpmControls } from "./nominal-primitive-subtype-npm-controls.mjs";

test("primitive-base npm archive reconciles four installed selections, complete packages and unchanged source epochs", async () => {
	const checked = await checkNominalPrimitiveSubtypeNpmArchive();
	assert.equal(checked.producerCommit, nominalPrimitiveSubtypeNpmProducer);
	assert.deepEqual(checked.installedProfiles, ["node-javascript", "node-typescript"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.requiredCiRegistered, false); assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeNpmSelections);
	let controls = 0;
	for(const run of checked.selections)
	{
		assert.deepEqual(run.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
		assert.equal(run.checks, run.mode === "full" ? 1213 : 578);
		assert.equal(run.rejections, run.mode === "full" ? 283 : 0);
		assert.equal(run.rounds, 256); assert.equal(run.executions, 2); assert.equal(run.wordBits, 32); assert.equal(run.dispatchObserved, false);
		assert.deepEqual(Object.keys(run.artifacts).sort(), ["@lean-bridge/runtime", "nominalprimitivesubtypes"]);
		controls += run.recordControls + run.reportControls + run.adapterControls;
	}
	assert.equal(controls, 474);
	assert.deepEqual((await nativeArtifactPaths(nominalPrimitiveSubtypeNpmArchive)).sort(), ["index.json", ...checked.files.map(file => file.path)].sort());
});

test("primitive-base npm archive refuses missing or changed producer, caller, package and runtime originals", async () => {
	const index = JSON.parse(await readFile(nominalPrimitiveSubtypeNpmArchive + "/index.json"));
	const targets = [
		"index.json", "producer.mjs", "controls-runner.mjs", "controls-helper.mjs"
		, "sources/src/analyze/NativeExports.lean", "runtime/main.wasm"
		, "sources/tests/fixtures/nominal-primitive-subtype-consumers/javascript.mjs"
		, ...index.runs.flatMap(({ route, mode }) => {
			const label = route + "/" + mode;
			return ["producer/start.json", "producer/complete.json", "producer/run.tap"
				, "controls/start.json", "controls/complete.json", "records/report.json"
				, "records/build-0/locks/compiler-adapters.json"
				, "records/installed/package-lock.json"]
				.map(path => label + "/" + path);
		})
		, ...index.files.filter(file => file.path.endsWith(".tgz")).map(file => file.path)
	];
	for(const path of targets) for(const missing of [true, false])
		await assert.rejects(checkNominalPrimitiveSubtypeNpmArchive(async requested => {
			if(requested !== nominalPrimitiveSubtypeNpmArchive + "/" + path) return readFile(requested);
			if(missing) throw new Error("Missing original: " + path);
			return Buffer.concat([await readFile(requested), Buffer.from("changed")]);
		}), undefined, path);
});

test("primitive-base npm archive refuses substituted host, source, selection and coverage index claims", async () => {
	const original = await readFile(nominalPrimitiveSubtypeNpmArchive + "/index.json"), index = JSON.parse(original);
	assert.equal(sha256(original), nominalPrimitiveSubtypeNpmArchiveSha256);
	const mutations = [
		value => { value.producerCommit = "0".repeat(40); }
		, value => { value.runs.pop(); }, value => { value.runs.reverse(); }
		, value => { value.runs.push(value.runs[0]); }
		, value => { value.runs[0].route = "reviewed"; }
		, value => { value.runs[0].mode = "result-only"; }
		, value => { value.runs[0].runtime.node = "v24.0.0"; }
		, value => { value.runs[0].counts.dispatchObserved = true; }
		, value => { value.runs[0].counts.executions = 1; }
		, value => { value.runs[0].tapSha256 = "0".repeat(64); }
		, value => { value.runs[0].reportSha256 = "0".repeat(64); }
		, value => { value.selectedSources.pop(); }
		, value => { value.files.pop(); }
		, value => { value.files.push(value.files[0]); }
		, value => { value.files[0].path = "../outside"; }
		, value => { value.files[0].sha256 = "0".repeat(64); }
		, value => { value.limitations = []; }
	];
	for(const mutate of mutations)
	{
		const value = structuredClone(index); mutate(value);
		await assert.rejects(checkNominalPrimitiveSubtypeNpmArchive(async path => path.endsWith("/index.json") ? Buffer.from(canonicalJson(value)) : readFile(path)));
	}
	assert.deepEqual(await readFile(nominalPrimitiveSubtypeNpmArchive + "/index.json"), original);
});

test("primitive-base npm archived originals reject all 474 coordinated record and constructor controls", async () => {
	const index = JSON.parse(await readFile(nominalPrimitiveSubtypeNpmArchive + "/index.json"));
	assert.equal(sha256(canonicalJson(index)), nominalPrimitiveSubtypeNpmArchiveSha256);
	let controls = 0;
	for(const run of index.runs)
	{
		const checked = await checkNominalPrimitiveSubtypeNpmControls(path => readFile(`${nominalPrimitiveSubtypeNpmArchive}/${run.route}/${run.mode}/records/${path}`), run);
		assert.deepEqual(checked, { ...run.counts, recordControls: run.mode === "full" ? 64 : 62, reportControls: 23, adapterControls: run.mode === "full" ? 42 : 23 });
		controls += checked.recordControls + checked.reportControls + checked.adapterControls;
	}
	assert.equal(controls, 474);
});
